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

import { Binary } from "@ekacode/shared/binary";
import { Persist, persisted } from "@ekacode/shared/persist";
import { createContext, getOwner, JSX, onCleanup, onMount, useContext } from "solid-js";
import { createStore, produce, reconcile, type SetStoreFunction } from "solid-js/store";
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
        parentID?: string;
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
  tool?: {
    messageID: string;
    callID: string;
  };
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: unknown[];
  tool?: {
    messageID: string;
    callID: string;
  };
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
 * Store updater function - path-based SetStoreFunction for granular updates
 */
export type StoreUpdater<T> = SetStoreFunction<T>;

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
const DEBUG_GLOBAL_SYNC_LOG = false;
const DEBUG_PREFIX = "[eka-debug]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function parseMessageInfo(input: unknown):
  | {
      id: string;
      role: "user" | "assistant" | "system";
      sessionID?: string;
      time?: { created: number; completed?: number };
      parentID?: string;
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
    parentID: typeof input.parentID === "string" ? input.parentID : undefined,
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

      const result = Binary(store.session, session.sessionId, (s: Session) => s.sessionId);
      if (result.found) {
        setStore("session", result.index, reconcile(session));
      } else {
        setStore(
          "session",
          produce(draft => {
            draft.splice(result.index, 0, session);
          })
        );
      }
      break;
    }

    case "session.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const parsed = parseSession(props.info);
      if (!parsed) break;

      const result = Binary(store.session, parsed.sessionId, (s: Session) => s.sessionId);
      if (result.found) {
        setStore("session", result.index, reconcile(parsed));
      } else {
        setStore(
          "session",
          produce(draft => {
            draft.splice(result.index, 0, parsed);
          })
        );
      }
      break;
    }

    case "session.status": {
      const props = isRecord(event.properties) ? event.properties : {};
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const status = isRecord(props.status) ? (props.status as SessionStatus["status"]) : undefined;
      if (!sessionID || !status) break;
      setStore("sessionStatus", sessionID, reconcile({ status }));
      break;
    }

    case "message.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const info = parseMessageInfo(props.info);
      if (!info) break;
      const sessionID = info.sessionID;
      if (!sessionID) break;

      if (DEBUG_GLOBAL_SYNC_LOG) {
        console.log(`${DEBUG_PREFIX} global-sync message.updated received`, {
          sessionID,
          messageID: info.id,
          role: info.role,
          existingCount: store.message[sessionID]?.length ?? 0,
        });
      }

      const messages = store.message[sessionID];
      if (!messages) {
        // No messages yet for this session - create the array with this message
        const existingParts = store.part[info.id] ?? [];
        const newMessage: Message = {
          info,
          parts: existingParts,
          createdAt: info.time?.created,
          updatedAt: Date.now(),
        };
        setStore("message", sessionID, [newMessage]);
        break;
      }

      const result = Binary(messages, info.id, (m: Message) => m.info.id);
      const existingMessage = result.found ? messages[result.index] : undefined;
      const newMessage: Message = {
        info,
        parts: store.part[info.id] ?? existingMessage?.parts ?? [],
        createdAt: existingMessage?.createdAt ?? info.time?.created,
        updatedAt: Date.now(),
      };

      if (result.found) {
        // Update existing message at index with reconcile for granular updates
        setStore("message", sessionID, result.index, reconcile(newMessage));
      } else {
        // Insert new message at correct position
        setStore(
          "message",
          sessionID,
          produce(draft => {
            draft.splice(result.index, 0, newMessage);
          })
        );
      }

      if (DEBUG_GLOBAL_SYNC_LOG) {
        console.log(`${DEBUG_PREFIX} global-sync message.updated applied`, {
          sessionID,
          messageID: info.id,
          found: result.found,
          index: result.index,
        });
      }
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

      if (DEBUG_GLOBAL_SYNC_LOG) {
        console.log(`${DEBUG_PREFIX} global-sync message.part.updated received`, {
          sessionID: part.sessionID,
          messageID: part.messageID,
          partID: part.id,
          partType: part.type,
          existingPartCount: store.part[part.messageID]?.length ?? 0,
        });
      }

      const parts = store.part[part.messageID];
      if (!parts) {
        // No parts yet for this message - create the array
        setStore("part", part.messageID, [part]);
        break;
      }

      const result = Binary(parts, part.id, (p: Part) => p.id);
      if (result.found) {
        // Update existing part with reconcile for granular updates
        setStore("part", part.messageID, result.index, reconcile(part));
      } else {
        // Insert new part at correct position
        setStore(
          "part",
          part.messageID,
          produce(draft => {
            draft.splice(result.index, 0, part);
          })
        );
      }
      break;
    }

    case "message.part.removed": {
      const props = isRecord(event.properties) ? event.properties : {};
      const messageID = typeof props.messageID === "string" ? props.messageID : undefined;
      const partID = typeof props.partID === "string" ? props.partID : undefined;
      if (!messageID || !partID) break;

      const parts = store.part[messageID];
      if (!parts) break;

      const result = Binary(parts, partID, (p: Part) => p.id);
      if (!result.found) break;

      setStore(
        produce(draft => {
          const list = draft.part[messageID];
          if (!list) return;
          const next = Binary(list, partID, (p: Part) => p.id);
          if (!next.found) return;
          list.splice(next.index, 1);
          if (list.length === 0) delete draft.part[messageID];
        })
      );
      break;
    }

    case "permission.asked": {
      const props = isRecord(event.properties) ? event.properties : {};
      const tool =
        isRecord(props.tool) &&
        typeof props.tool.messageID === "string" &&
        typeof props.tool.callID === "string"
          ? {
              messageID: props.tool.messageID,
              callID: props.tool.callID,
            }
          : undefined;
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
              tool,
            } satisfies PermissionRequest)
          : undefined;
      if (!permission) break;

      const permissions = store.permission[permission.sessionID];
      if (!permissions) {
        setStore("permission", permission.sessionID, [permission]);
        break;
      }

      const result = Binary(permissions, permission.id, (p: PermissionRequest) => p.id);
      if (result.found) {
        setStore("permission", permission.sessionID, result.index, reconcile(permission));
      } else {
        setStore(
          "permission",
          permission.sessionID,
          produce(draft => {
            draft.splice(result.index, 0, permission);
          })
        );
      }
      break;
    }

    case "permission.replied": {
      const props = isRecord(event.properties) ? event.properties : {};
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const requestID = typeof props.requestID === "string" ? props.requestID : undefined;
      if (!sessionID || !requestID) break;

      const permissions = store.permission[sessionID];
      if (!permissions) break;

      const result = Binary(permissions, requestID, (p: PermissionRequest) => p.id);
      if (!result.found) break;

      setStore(
        "permission",
        sessionID,
        produce(draft => {
          draft.splice(result.index, 1);
        })
      );
      break;
    }

    case "question.asked": {
      const props = isRecord(event.properties) ? event.properties : {};
      const tool =
        isRecord(props.tool) &&
        typeof props.tool.messageID === "string" &&
        typeof props.tool.callID === "string"
          ? {
              messageID: props.tool.messageID,
              callID: props.tool.callID,
            }
          : undefined;
      const question =
        typeof props.id === "string" &&
        typeof props.sessionID === "string" &&
        Array.isArray(props.questions)
          ? ({
              id: props.id,
              sessionID: props.sessionID,
              questions: props.questions,
              tool,
            } satisfies QuestionRequest)
          : undefined;
      if (!question) break;

      const questions = store.question[question.sessionID];
      if (!questions) {
        setStore("question", question.sessionID, [question]);
        break;
      }

      const result = Binary(questions, question.id, (q: QuestionRequest) => q.id);
      if (result.found) {
        setStore("question", question.sessionID, result.index, reconcile(question));
      } else {
        setStore(
          "question",
          question.sessionID,
          produce(draft => {
            draft.splice(result.index, 0, question);
          })
        );
      }
      break;
    }

    case "question.replied":
    case "question.rejected": {
      const props = isRecord(event.properties) ? event.properties : {};
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const requestID = typeof props.requestID === "string" ? props.requestID : undefined;
      if (!sessionID || !requestID) break;

      const questions = store.question[sessionID];
      if (!questions) break;

      const result = Binary(questions, requestID, (q: QuestionRequest) => q.id);
      if (!result.found) break;

      setStore(
        "question",
        sessionID,
        produce(draft => {
          draft.splice(result.index, 1);
        })
      );
      break;
    }
  }

  if (!store.ready) {
    setStore("ready", true);
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
   * Create a SetStoreFunction wrapper that persists after updates
   */
  function createUpdater(
    directory: string,
    store: DirectoryStore,
    setSolidStore: SetStoreFunction<DirectoryStore>
  ): StoreUpdater<DirectoryStore> {
    // Return the SetStoreFunction directly wrapped with persistence scheduling
    return ((...args: unknown[]) => {
      // Apply the store update
      (setSolidStore as (...args: unknown[]) => void)(...args);
      // Schedule persistence after the reactive update completes
      queueMicrotask(() => savePersisted(directory, store));
    }) as StoreUpdater<DirectoryStore>;
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
          updater("ready", true);
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

      setStore("session", reconcile(transformed));
      setStore("ready", true);
    } catch (error) {
      console.error(`Failed to load sessions for ${directory}:`, error);
      setStore("ready", true);
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
