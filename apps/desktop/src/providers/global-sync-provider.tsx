/**
 * Global Sync Provider - Opencode-style child store management
 *
 * Provides:
 * - Child stores per directory/workspace
 * - Session loading and management
 * - Directory-routed event handling from GlobalSDKProvider
 * - Bootstrap for loading initial data
 * - Persisted cache with versioned keys
 *
 * Based on opencode packages/app/src/context/global-sync.tsx
 */

import { Persist, persisted } from "@ekacode/shared/persist";
import { createContext, getOwner, JSX, onCleanup, onMount, useContext } from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";
import {
  canDisposeDirectory,
  createInitialDirState,
  DIR_IDLE_TTL_MS,
  MAX_DIR_STORES,
  pickDirectoriesToEvict,
  touchDirState,
  type DirState,
} from "../lib/eviction";
import { useGlobalSDK, type ServerEvent } from "./global-sdk-provider";

/**
 * Session types
 */
export interface Session {
  sessionId: string;
  resourceId: string;
  threadId?: string;
  createdAt: number;
  lastAccessed: number;
}

export interface Message {
  info:
    | { role: "user"; id: string; sessionID?: string; time?: { created: number } }
    | {
        role: "assistant";
        id: string;
        model?: string;
        provider?: string;
        sessionID?: string;
        time?: { created: number; completed?: number };
      }
    | { role: "system"; id: string };
  parts: Part[];
  createdAt?: number;
  updatedAt?: number;
}

export interface Part {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface SessionStatus {
  status:
    | { type: "idle" }
    | { type: "busy" }
    | { type: "retry"; attempt: number; message: string; next: number };
}

export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: unknown[];
}

/**
 * Directory store state
 */
export interface DirectoryStore {
  ready: boolean;
  session: Session[];
  message: Record<string, Message[]>;
  part: Record<string, Part[]>;
  sessionStatus: Record<string, SessionStatus>;
  permission: Record<string, PermissionRequest[]>;
  question: Record<string, QuestionRequest[]>;
  limit: number;
}

/**
 * Store updater function - compatible with both produce and SetStoreFunction patterns
 */
export type StoreUpdater<T> = (updater: (state: T) => T) => void;

/**
 * Global sync context value
 */
export interface GlobalSyncContextValue {
  ready: boolean;
  child: (
    directory: string,
    options?: { bootstrap?: boolean }
  ) => readonly [DirectoryStore, StoreUpdater<DirectoryStore>];
  loadSessions: (directory: string) => Promise<void>;
  bootstrap: () => Promise<void>;
  pin: (directory: string) => void;
  unpin: (directory: string) => void;
}

/**
 * Initial directory store state
 */
export function createInitialDirectoryStore(): DirectoryStore {
  return {
    ready: false,
    session: [],
    message: {},
    part: {},
    sessionStatus: {},
    permission: {},
    question: {},
    limit: 100,
  };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex(x => x.id === item.id);
  if (index === -1) {
    const next = [...list, item];
    next.sort((a, b) => cmp(a.id, b.id));
    return next;
  }
  const next = [...list];
  next[index] = item;
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  const index = list.findIndex(x => x.id === id);
  if (index === -1) return list;
  const next = [...list];
  next.splice(index, 1);
  return next;
}

function normalizeMessageRole(role: unknown): "user" | "assistant" | "system" {
  if (role === "user" || role === "assistant" || role === "system") return role;
  return "assistant";
}

function parseSession(input: unknown): Session | undefined {
  if (!isRecord(input)) return undefined;

  const sessionId =
    typeof input.sessionId === "string"
      ? input.sessionId
      : typeof input.id === "string"
        ? input.id
        : undefined;
  if (!sessionId) return undefined;

  const createdAtRaw =
    typeof input.createdAt === "number"
      ? input.createdAt
      : typeof input.createdAt === "string"
        ? Date.parse(input.createdAt)
        : undefined;
  const lastAccessedRaw =
    typeof input.lastAccessed === "number"
      ? input.lastAccessed
      : typeof input.lastAccessed === "string"
        ? Date.parse(input.lastAccessed)
        : undefined;

  return {
    sessionId,
    resourceId: typeof input.resourceId === "string" ? input.resourceId : "local",
    threadId: typeof input.threadId === "string" ? input.threadId : undefined,
    createdAt: Number.isFinite(createdAtRaw) ? (createdAtRaw as number) : Date.now(),
    lastAccessed: Number.isFinite(lastAccessedRaw) ? (lastAccessedRaw as number) : Date.now(),
  };
}

function parseMessageInfo(
  input: unknown
):
  | {
      id: string;
      role: "user" | "assistant" | "system";
      sessionID?: string;
      time?: { created: number; completed?: number };
      model?: string;
      provider?: string;
    }
  | undefined {
  if (!isRecord(input)) return undefined;
  if (typeof input.id !== "string") return undefined;

  const time = isRecord(input.time)
    ? {
        created: typeof input.time.created === "number" ? input.time.created : Date.now(),
        completed: typeof input.time.completed === "number" ? input.time.completed : undefined,
      }
    : undefined;

  return {
    id: input.id,
    role: normalizeMessageRole(input.role),
    sessionID: typeof input.sessionID === "string" ? input.sessionID : undefined,
    time,
    model:
      typeof input.model === "string"
        ? input.model
        : typeof input.modelID === "string"
          ? input.modelID
          : undefined,
    provider:
      typeof input.provider === "string"
        ? input.provider
        : typeof input.providerID === "string"
          ? input.providerID
          : undefined,
  };
}

export function applyDirectoryEvent(input: {
  event: ServerEvent;
  store: DirectoryStore;
  setStore: StoreUpdater<DirectoryStore>;
}): void {
  const { event, store, setStore } = input;

  switch (event.type) {
    case "session.created": {
      const props = isRecord(event.properties) ? event.properties : {};
      const parsed = parseSession(props.info);
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const session =
        parsed ??
        (sessionID
          ? {
              sessionId: sessionID,
              resourceId: "local",
              createdAt: Date.now(),
              lastAccessed: Date.now(),
            }
          : undefined);
      if (!session) break;

      setStore(state => {
        const sessionList = upsertById(
          state.session.map(s => ({ ...s, id: s.sessionId })) as Array<Session & { id: string }>,
          { ...(session as Session), id: session.sessionId }
        ).map(({ id: _id, ...rest }) => rest as Session);
        return { ...state, session: sessionList };
      });
      break;
    }

    case "session.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const parsed = parseSession(props.info);
      if (parsed) {
        setStore(state => {
          const sessionList = upsertById(
            state.session.map(s => ({ ...s, id: s.sessionId })) as Array<Session & { id: string }>,
            { ...(parsed as Session), id: parsed.sessionId }
          ).map(({ id: _id, ...rest }) => rest as Session);
          return { ...state, session: sessionList };
        });
      }
      break;
    }

    case "session.status": {
      const props = isRecord(event.properties) ? event.properties : {};
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const status = isRecord(props.status) ? (props.status as SessionStatus["status"]) : undefined;
      if (!sessionID || !status) break;
      setStore(state => ({
        ...state,
        sessionStatus: {
          ...state.sessionStatus,
          [sessionID]: { status },
        },
      }));
      break;
    }

    case "message.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const info = parseMessageInfo(props.info);
      if (!info) break;
      const sessionID = info.sessionID;
      if (!sessionID) break;

      setStore(state => {
        const existing = state.message[sessionID] ?? [];
        const existingMessage = existing.find(m => m.info.id === info.id);
        const nextMessage: Message = {
          info,
          parts: state.part[info.id] ?? existingMessage?.parts ?? [],
          createdAt: existingMessage?.createdAt ?? info.time?.created,
          updatedAt: Date.now(),
        };
        const nextMessages = upsertById(
          existing.map(m => ({ ...m, id: m.info.id })) as Array<Message & { id: string }>,
          { ...nextMessage, id: info.id }
        ).map(({ id: _id, ...rest }) => rest as Message);

        return {
          ...state,
          message: {
            ...state.message,
            [sessionID]: nextMessages,
          },
        };
      });
      break;
    }

    case "message.part.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const part = isRecord(props.part) ? (props.part as Part) : undefined;
      if (
        !part ||
        typeof part.id !== "string" ||
        typeof part.messageID !== "string" ||
        typeof part.sessionID !== "string"
      ) {
        break;
      }

      setStore(state => {
        const existingParts = state.part[part.messageID] ?? [];
        const nextParts = upsertById(existingParts, part);

        const existingSessionMessages = state.message[part.sessionID] ?? [];
        const messageIndex = existingSessionMessages.findIndex(m => m.info.id === part.messageID);
        let nextSessionMessages = existingSessionMessages;

        if (messageIndex === -1) {
          nextSessionMessages = upsertById(
            existingSessionMessages.map(m => ({ ...m, id: m.info.id })) as Array<
              Message & { id: string }
            >,
            {
              id: part.messageID,
              info: {
                id: part.messageID,
                role: "assistant",
                sessionID: part.sessionID,
                time: { created: Date.now() },
              },
              parts: nextParts,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          ).map(({ id: _id, ...rest }) => rest as Message);
        } else {
          nextSessionMessages = [...existingSessionMessages];
          nextSessionMessages[messageIndex] = {
            ...nextSessionMessages[messageIndex],
            parts: nextParts,
            updatedAt: Date.now(),
          };
        }

        return {
          ...state,
          part: {
            ...state.part,
            [part.messageID]: nextParts,
          },
          message: {
            ...state.message,
            [part.sessionID]: nextSessionMessages,
          },
        };
      });
      break;
    }

    case "message.part.removed": {
      const props = isRecord(event.properties) ? event.properties : {};
      const messageID = typeof props.messageID === "string" ? props.messageID : undefined;
      const partID = typeof props.partID === "string" ? props.partID : undefined;
      if (!messageID || !partID) break;

      setStore(state => {
        const existingParts = state.part[messageID] ?? [];
        const nextParts = removeById(existingParts, partID);
        if (nextParts === existingParts) return state;

        const partMap = { ...state.part };
        if (nextParts.length === 0) {
          delete partMap[messageID];
        } else {
          partMap[messageID] = nextParts;
        }

        return {
          ...state,
          part: partMap,
        };
      });
      break;
    }

    case "permission.asked": {
      const props = isRecord(event.properties) ? event.properties : {};
      const permission =
        typeof props.id === "string" &&
        typeof props.sessionID === "string" &&
        typeof props.permission === "string" &&
        Array.isArray(props.patterns)
          ? ({
              id: props.id,
              sessionID: props.sessionID,
              permission: props.permission,
              patterns: props.patterns.filter(
                (value): value is string => typeof value === "string"
              ),
            } satisfies PermissionRequest)
          : undefined;
      if (!permission) {
        break;
      }

      setStore(state => {
        const list = state.permission[permission.sessionID] ?? [];
        const next = upsertById(list, permission);
        return {
          ...state,
          permission: {
            ...state.permission,
            [permission.sessionID]: next,
          },
        };
      });
      break;
    }

    case "permission.replied": {
      const props = isRecord(event.properties) ? event.properties : {};
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const requestID = typeof props.requestID === "string" ? props.requestID : undefined;
      if (!sessionID || !requestID) break;

      setStore(state => {
        const list = state.permission[sessionID] ?? [];
        const next = removeById(list, requestID);
        if (next === list) return state;
        return {
          ...state,
          permission: {
            ...state.permission,
            [sessionID]: next,
          },
        };
      });
      break;
    }
  }

  if (!store.ready) {
    setStore(state => ({ ...state, ready: true }));
  }
}

/**
 * Child store manager
 * Creates and manages child stores per directory with persisted cache and LRU eviction
 */
function createChildStoreManager() {
  const owner = getOwner();
  if (!owner) throw new Error("ChildStoreManager must be created within owner");

  const children = new Map<string, readonly [DirectoryStore, StoreUpdater<DirectoryStore>]>();
  const persistTargets = new Map<string, ReturnType<typeof persisted<DirectoryStore>>>();
  const dirStates = new Map<string, DirState>();
  const pinnedDirs = new Set<string>();

  /**
   * Run eviction check and dispose of eligible directories
   */
  function runEviction() {
    const now = Date.now();
    const directories = Array.from(children.keys());

    const toEvict = pickDirectoriesToEvict({
      stores: directories,
      max: MAX_DIR_STORES,
      ttl: DIR_IDLE_TTL_MS,
      now,
      pins: pinnedDirs,
      state: dirStates,
    });

    for (const dir of toEvict) {
      const state = dirStates.get(dir);
      if (!state) continue;

      const canDispose = canDisposeDirectory({
        directory: dir,
        hasStore: children.has(dir),
        pinned: state.pinned,
        booting: state.booting,
        loadingSessions: state.loadingSessions,
      });

      if (canDispose) {
        children.delete(dir);
        persistTargets.delete(dir);
        dirStates.delete(dir);
        console.debug(`Evicted directory store: ${dir}`);
      }
    }
  }

  /**
   * Load persisted state for a directory
   */
  function loadPersisted(directory: string): Partial<DirectoryStore> {
    const target = Persist.workspace(directory, "store");
    const storage = persisted(target, createInitialDirectoryStore());
    persistTargets.set(directory, storage);

    const loaded = storage.read();
    // Don't restore ready state - always start as not ready
    delete (loaded as Partial<DirectoryStore>).ready;
    return loaded;
  }

  /**
   * Persist state for a directory
   */
  function savePersisted(directory: string, store: DirectoryStore) {
    const storage = persistTargets.get(directory);
    if (storage) {
      storage.write(store);
    }
  }

  /**
   * Create a produce-compatible wrapper around SetStoreFunction
   */
  function createUpdater(
    directory: string,
    store: DirectoryStore,
    setSolidStore: SetStoreFunction<DirectoryStore>
  ): StoreUpdater<DirectoryStore> {
    return updater => {
      setSolidStore(state => updater(state as DirectoryStore));
      void savePersisted(directory, store);
    };
  }

  /**
   * Update directory state access time
   */
  function touchDirectory(directory: string) {
    const existing = dirStates.get(directory);
    dirStates.set(directory, existing ? touchDirState(existing) : createInitialDirState());
  }

  return {
    get children() {
      return children;
    },
    get dirStates() {
      return dirStates;
    },
    ensureChild(directory: string) {
      if (!children.has(directory)) {
        const persistedData = loadPersisted(directory);
        const initial = { ...createInitialDirectoryStore(), ...persistedData };
        const [store, setSolidStore] = createStore(initial);
        const updater = createUpdater(directory, store, setSolidStore);
        children.set(directory, [store, updater] as const);
        touchDirectory(directory);
        return [store, updater] as const;
      }
      // Update access time for existing child
      touchDirectory(directory);
      return children.get(directory)!;
    },
    child(directory: string, options: { bootstrap?: boolean } = {}) {
      const existing = children.get(directory);
      if (existing) {
        touchDirectory(directory);
        return existing;
      }

      const persistedData = loadPersisted(directory);
      const initial = { ...createInitialDirectoryStore(), ...persistedData };
      const [store, setSolidStore] = createStore(initial);
      const updater = createUpdater(directory, store, setSolidStore);
      children.set(directory, [store, updater] as const);
      touchDirectory(directory);

      if (options.bootstrap !== false) {
        // Trigger bootstrap asynchronously - mark as ready immediately
        setTimeout(() => {
          updater(state => ({ ...state, ready: true }));
        }, 0);
      }

      // Run eviction after creating a new child
      runEviction();

      return [store, updater] as const;
    },
    disposeDirectory(directory: string) {
      children.delete(directory);
      persistTargets.delete(directory);
      dirStates.delete(directory);
    },
    pinDirectory(directory: string) {
      pinnedDirs.add(directory);
      const state = dirStates.get(directory);
      if (state) {
        dirStates.set(directory, { ...state, pinned: true });
      }
    },
    unpinDirectory(directory: string) {
      pinnedDirs.delete(directory);
      const state = dirStates.get(directory);
      if (state) {
        dirStates.set(directory, { ...state, pinned: false });
      }
    },
  };
}

/**
 * Global Sync Context
 */
const GlobalSyncContext = createContext<GlobalSyncContextValue | undefined>(undefined);

/**
 * Global Sync Provider component
 */
export function GlobalSyncProvider(props: { children: JSX.Element }) {
  const globalSDK = useGlobalSDK();
  const children = createChildStoreManager();
  const [ready, setReady] = createStore({ globalReady: false });

  /**
   * Load sessions from server for a directory
   */
  async function loadSessions(directory: string): Promise<void> {
    const child = children.ensureChild(directory);
    const [, setStore] = child;

    try {
      const sessions = await globalSDK.client.session.list();
      const transformed = sessions
        .map(session => ({
          sessionId: session.sessionId,
          resourceId: session.resourceId,
          threadId: session.threadId,
          createdAt: Date.parse(session.createdAt),
          lastAccessed: Date.parse(session.lastAccessed),
        }))
        .filter(session => !!session.sessionId)
        .sort((a, b) => cmp(a.sessionId, b.sessionId));

      setStore(state => ({
        ...state,
        session: transformed,
        ready: true,
      }));
    } catch (error) {
      console.error(`Failed to load sessions for ${directory}:`, error);
      setStore(state => ({ ...state, ready: true }));
    }
  }

  /**
   * Bootstrap global state
   */
  async function bootstrap(): Promise<void> {
    setReady({ globalReady: true });
  }

  const applyToDirectory = (directory: string, event: ServerEvent) => {
    const existing = children.children.get(directory);
    if (!existing) return;
    const [store, setStore] = existing;
    applyDirectoryEvent({ event, store, setStore });
  };

  const unlisten = globalSDK.event.listen(entry => {
    const directory = entry.name;
    const event = entry.details;

    if (directory === "global") {
      const props = isRecord(event.properties) ? event.properties : {};
      const routedDirectory =
        typeof props.directory === "string" && props.directory.length > 0
          ? props.directory
          : undefined;

      if (routedDirectory) {
        applyToDirectory(routedDirectory, event);
        return;
      }

      // Fallback for legacy payloads without explicit directory.
      if (children.children.size === 1) {
        const only = children.children.keys().next();
        if (!only.done && typeof only.value === "string") {
          applyToDirectory(only.value, event);
        }
      }
      return;
    }

    applyToDirectory(directory, event);
  });

  onCleanup(unlisten);

  onMount(() => {
    void bootstrap();
  });

  /**
   * Pin a directory to prevent eviction
   */
  function pin(directory: string): void {
    children.pinDirectory(directory);
  }

  /**
   * Unpin a directory to allow eviction
   */
  function unpin(directory: string): void {
    children.unpinDirectory(directory);
  }

  const value: GlobalSyncContextValue = {
    get ready() {
      return ready.globalReady;
    },
    child: children.child,
    loadSessions,
    bootstrap,
    pin,
    unpin,
  };

  return <GlobalSyncContext.Provider value={value}>{props.children}</GlobalSyncContext.Provider>;
}

/**
 * Hook to access global sync context
 */
export function useGlobalSync(): GlobalSyncContextValue {
  const context = useContext(GlobalSyncContext);
  if (!context) throw new Error("useGlobalSync must be used within GlobalSyncProvider");
  return context;
}
