/**
 * Sync Provider - Opencode-style per-session message sync
 *
 * Provides:
 * - Per-session message/part loading with pagination
 * - Optimistic message add/remove
 * - Message synchronization with server
 *
 * Based on opencode packages/app/src/context/sync.tsx
 */

import { Binary } from "@ekacode/shared/binary";
import { batch, createContext, JSX, useContext } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { useGlobalSDK } from "./global-sdk-provider";
import type { Message, Part, Session } from "./global-sync-provider";
import { useGlobalSync } from "./global-sync-provider";

/**
 * Key function for caching
 */
const keyFor = (directory: string, id: string) => `${directory}:${id}`;

/**
 * Compare strings for sorting
 */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const DEBUG_SYNC_LOG = false;
const DEBUG_PREFIX = "[eka-debug]";

const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && /^HTTP 404\b/.test(error.message);

/**
 * Optimistic store (subset of DirectoryStore for optimistic updates)
 */
type OptimisticStore = {
  message: Record<string, Message[] | undefined>;
  part: Record<string, Part[] | undefined>;
};

/**
 * Optimistic add input
 */
type OptimisticAddInput = {
  sessionID: string;
  message: Message;
  parts: Part[];
};

/**
 * Optimistic remove input
 */
type OptimisticRemoveInput = {
  sessionID: string;
  messageID: string;
};

/**
 * Apply optimistic message add using binary search
 */
export function applyOptimisticAdd(draft: OptimisticStore, input: OptimisticAddInput) {
  const messages = draft.message[input.sessionID];
  if (!messages) {
    draft.message[input.sessionID] = [input.message];
  } else {
    const result = Binary(messages, input.message.info.id, (m: Message) => m.info.id);
    if (result.found) {
      messages[result.index] = input.message;
    } else {
      messages.splice(result.index, 0, input.message);
    }
  }
  draft.part[input.message.info.id] = input.parts
    .filter(part => !!part?.id)
    .sort((a, b) => cmp(a.id, b.id));
}

/**
 * Apply optimistic message remove using binary search
 */
export function applyOptimisticRemove(draft: OptimisticStore, input: OptimisticRemoveInput) {
  const messages = draft.message[input.sessionID];
  if (messages) {
    const result = Binary(messages, input.messageID, (m: Message) => m.info.id);
    if (result.found) {
      messages.splice(result.index, 1);
    }
  }
  delete draft.part[input.messageID];
}

/**
 * Sync Context
 */
const SyncContext = createContext<ReturnType<typeof createSync> | undefined>(undefined);

/**
 * Create sync provider
 * Gets child store from GlobalSyncProvider for the given directory
 */
function createSync(directory: string) {
  const globalSync = useGlobalSync();
  const globalSDK = useGlobalSDK();

  // Get child store from GlobalSyncProvider
  const [store, setStore] = globalSync.child(directory, { bootstrap: true });

  // Mark as ready after child store is created
  setStore("ready", true);

  const chunk = 400;
  const inflight = new Map<string, Promise<void>>();
  const [meta, setMeta] = createStore({
    limit: {} as Record<string, number>,
    complete: {} as Record<string, boolean>,
    loading: {} as Record<string, boolean>,
  });

  /**
   * Get session by ID
   */
  const getSession = (sessionID: string) => {
    const match = Binary(store.session, sessionID, (s: Session) => s.sessionId);
    if (match.found) return store.session[match.index];
    return undefined;
  };

  /**
   * Calculate limit for pagination
   */
  const limitFor = (count: number) => {
    if (count <= chunk) return chunk;
    return Math.ceil(count / chunk) * chunk;
  };

  /**
   * Load messages for a session
   */
  const loadMessages = async (sessionID: string, limit = chunk) => {
    const key = keyFor(directory, sessionID);
    if (meta.loading[key]) return;

    const prevCount = store.message[sessionID]?.length ?? 0;

    setMeta("loading", key, true);

    try {
      const result = await globalSDK.client.session.messages({ sessionID, limit });
      const messages = ((result.messages || []) as Message[])
        .filter(message => !!message?.info?.id)
        .slice()
        .sort((a, b) => cmp(a.info.id, b.info.id));

      if (DEBUG_SYNC_LOG) {
        const ids = messages.map(message => message.info.id);
        const duplicateIDs = ids.filter((id, index) => ids.indexOf(id) !== index);
        console.log(`${DEBUG_PREFIX} sync loadMessages`, {
          directory,
          sessionID,
          limit,
          prevCount,
          nextCount: messages.length,
          duplicateIDs,
          sample: messages.slice(0, 5).map(message => ({
            id: message.info.id,
            role: message.info.role,
            parts: ((message as { parts?: Part[] }).parts || []).length,
          })),
        });
      }

      batch(() => {
        // Update messages for session with reconcile for granular updates
        setStore("message", sessionID, reconcile(messages));

        // Update parts for each message
        for (const message of messages) {
          const parts = (message as { parts?: Part[] }).parts || [];
          const sortedParts = parts.filter(p => !!p?.id).sort((a, b) => cmp(a.id, b.id));
          setStore("part", message.info.id, reconcile(sortedParts));
        }

        setMeta("limit", key, limit);
        setMeta("complete", key, messages.length < limit);
      });
    } catch (error) {
      console.error(`Failed to load messages for session ${sessionID}:`, error);
    } finally {
      setMeta("loading", key, false);
    }
  };

  return {
    get data() {
      return store;
    },
    get set() {
      return setStore;
    },
    get ready() {
      return store.ready;
    },
    session: {
      get: getSession,
      optimistic: {
        add(input: OptimisticAddInput) {
          setStore(
            produce(draft => {
              applyOptimisticAdd(draft as unknown as OptimisticStore, input);
            })
          );
        },
        remove(input: OptimisticRemoveInput) {
          setStore(
            produce(draft => {
              applyOptimisticRemove(draft as unknown as OptimisticStore, input);
            })
          );
        },
      },
      addOptimisticMessage(input: { sessionID: string; messageID: string; text: string }) {
        const message: Message = {
          info: {
            role: "user",
            id: input.messageID,
            sessionID: input.sessionID,
            time: { created: Date.now() },
          },
          parts: [],
        };

        const textPart: Part = {
          id: `${input.messageID}-text`,
          sessionID: input.sessionID,
          messageID: input.messageID,
          type: "text",
          text: input.text,
        };

        message.parts = [textPart];

        setStore(
          produce(draft => {
            applyOptimisticAdd(draft as unknown as OptimisticStore, {
              sessionID: input.sessionID,
              message,
              parts: [textPart],
            });
          })
        );
      },
      async sync(sessionID: string) {
        const key = keyFor(directory, sessionID);
        const hasSession = (() => {
          const match = Binary(store.session, sessionID, (s: Session) => s.sessionId);
          return match.found;
        })();

        const hasMessages = store.message[sessionID] !== undefined;
        const hydrated = meta.limit[key] !== undefined;
        if (DEBUG_SYNC_LOG) {
          console.log(`${DEBUG_PREFIX} sync session.sync`, {
            directory,
            sessionID,
            hasSession,
            hasMessages,
            hydrated,
            messageCount: store.message[sessionID]?.length ?? 0,
          });
        }
        if (hasSession && hasMessages && hydrated) return;

        const pending = inflight.get(key);
        if (pending) return pending;

        const count = store.message[sessionID]?.length ?? 0;
        const limit = hydrated ? (meta.limit[key] ?? chunk) : limitFor(count);

        // Load session if not exists
        let sessionExists = hasSession;
        if (!hasSession) {
          try {
            const session = await globalSDK.client.session.get(sessionID);
            const transformed: Session = {
              sessionId: session.sessionId,
              resourceId: session.resourceId,
              threadId: session.threadId,
              createdAt: new Date(session.createdAt).getTime(),
              lastAccessed: new Date(session.lastAccessed).getTime(),
            };

            const match = Binary(store.session, sessionID, (s: Session) => s.sessionId);
            if (match.found) {
              setStore("session", match.index, reconcile(transformed));
            } else {
              setStore(
                "session",
                produce(draft => {
                  draft.splice(match.index, 0, transformed);
                })
              );
            }
            sessionExists = true;
          } catch (error) {
            if (isNotFoundError(error)) {
              if (DEBUG_SYNC_LOG) {
                console.log(`${DEBUG_PREFIX} sync session not found`, { directory, sessionID });
              }
              return;
            }
            console.error(`Failed to load session ${sessionID}:`, error);
          }
        }

        if (!sessionExists) return;

        const messagesReq =
          hasMessages && hydrated ? Promise.resolve() : loadMessages(sessionID, limit);

        const promise = messagesReq.finally(() => {
          inflight.delete(key);
        });

        inflight.set(key, promise);
        return promise;
      },
      history: {
        more(sessionID: string) {
          if (store.message[sessionID] === undefined) return false;
          if (meta.limit[keyFor(directory, sessionID)] === undefined) return false;
          if (meta.complete[keyFor(directory, sessionID)]) return false;
          return true;
        },
        loading(sessionID: string) {
          const key = keyFor(directory, sessionID);
          return meta.loading[key] ?? false;
        },
        async loadMore(sessionID: string, count = chunk) {
          const key = keyFor(directory, sessionID);
          if (meta.loading[key]) return;
          if (meta.complete[key]) return;

          const currentLimit = meta.limit[key] ?? chunk;
          await loadMessages(sessionID, currentLimit + count);
        },
      },
      async fetch(count = 10) {
        setStore("limit", store.limit + count);
        const sessions = await globalSDK.client.session.list();
        const transformed: Session[] = sessions
          .map(s => ({
            sessionId: s.sessionId,
            resourceId: s.resourceId,
            threadId: s.threadId,
            createdAt: new Date(s.createdAt).getTime(),
            lastAccessed: new Date(s.lastAccessed).getTime(),
          }))
          .filter(s => !!s?.sessionId)
          .sort((a, b) => cmp(a.sessionId, b.sessionId))
          .slice(0, store.limit);

        setStore("session", reconcile(transformed));
      },
      get more() {
        return store.session.length >= store.limit;
      },
    },
    diff: async (sessionID: string) => {
      const response = await globalSDK.client.fetch(`/api/chat/${sessionID}/diff`);
      if (!response.ok) {
        throw new Error(`Failed to load diff for session ${sessionID}`);
      }
      return response.json() as Promise<{ sessionID: string; diffs: unknown[]; hasMore: boolean }>;
    },
    todo: async (sessionID: string) => {
      const response = await globalSDK.client.fetch(`/api/chat/${sessionID}/todo`);
      if (!response.ok) {
        throw new Error(`Failed to load todo for session ${sessionID}`);
      }
      return response.json() as Promise<{ sessionID: string; todos: unknown[]; hasMore: boolean }>;
    },
  };
}

/**
 * Sync Provider component
 */
export function SyncProvider(props: { directory: string; children: JSX.Element }) {
  const value = createSync(props.directory);
  return <SyncContext.Provider value={value}>{props.children}</SyncContext.Provider>;
}

/**
 * Hook to access sync context
 */
export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
}
