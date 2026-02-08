/**
 * @ekacode/desktop useChat hook
 *
 * Simplified chat interface using Opencode-style provider architecture.
 * Uses SyncProvider for per-session message management and optimistic updates.
 */

import { createEffect, createMemo, onCleanup, type Accessor } from "solid-js";
import { createStore } from "solid-js/store";
import { v7 as uuidv7 } from "uuid";
import { EkacodeApiClient } from "../lib/api-client";
import { createLogger } from "../lib/logger";
import { useSync } from "../providers/sync-provider";
import type { ChatState, ChatStatus, ChatUIMessage, RLMStateData } from "../types/ui-message";
import { useStreamDebugger, type UseStreamDebuggerResult } from "./use-stream-debugger";

const logger = createLogger("desktop:chat");

export interface UseChatOptions {
  client?: unknown;
  workspace?: () => unknown | undefined;
  initialMessages?: ChatUIMessage[];
  initialSessionId?: string;
  sessionId?: Accessor<string | null>;
  onError?: (error: Error) => void;
  onFinish?: (message: ChatUIMessage) => void;
  onRLMStateChange?: (state: RLMStateData) => void;
  onSessionIdReceived?: (sessionId: string) => void;
}

export interface UseChatResult {
  store: ChatState;
  messages: Accessor<ChatUIMessage[]>;
  status: Accessor<ChatStatus>;
  error: Accessor<Error | null>;
  isLoading: Accessor<boolean>;
  canSend: Accessor<boolean>;
  rlmState: Accessor<RLMStateData | null>;
  sessionId: Accessor<string | null>;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  streamDebugger: UseStreamDebuggerResult;
}

// Local state for status tracking (not message content)
interface LocalChatState {
  status: ChatStatus;
  error: Error | null;
  rlmState: RLMStateData | null;
  sessionId: string | null;
}

export function useChat(options: UseChatOptions): UseChatResult {
  const { initialSessionId, onError, onFinish } = options;
  const DEBUG_CHAT_RENDER = false;
  const DEBUG_PREFIX = "[eka-debug]";

  // Use SyncProvider for message management
  const sync = useSync();
  const data = sync.data;

  // Local state for status tracking (content comes from SyncProvider)
  const [localState, setLocalState] = createStore<LocalChatState>({
    status: "idle",
    error: null,
    rlmState: null,
    sessionId: options.sessionId?.() ?? initialSessionId ?? null,
  });

  const streamDebugger = useStreamDebugger();

  let activeAbortController: AbortController | null = null;
  let pendingSessionId: string | null = null;
  let lastMessageProjectionSignature = "";

  onCleanup(() => {
    activeAbortController?.abort();
  });

  createEffect(() => {
    if (!options.sessionId) return;

    const externalSessionId = options.sessionId() ?? null;
    if (DEBUG_CHAT_RENDER) {
      console.log(`${DEBUG_PREFIX} useChat external session effect`, {
        externalSessionId,
        localSessionId: localState.sessionId,
        pendingSessionId,
        status: localState.status,
      });
    }
    if (externalSessionId === localState.sessionId) {
      if (pendingSessionId && pendingSessionId === externalSessionId) {
        pendingSessionId = null;
      }
      return;
    }

    // During new-session creation, local session id can temporarily lead external state.
    if (
      pendingSessionId &&
      localState.sessionId === pendingSessionId &&
      externalSessionId === null &&
      (localState.status === "connecting" || localState.status === "streaming")
    ) {
      return;
    }

    activeAbortController?.abort();
    activeAbortController = null;
    pendingSessionId = null;
    setLocalState("sessionId", externalSessionId);
    setLocalState("status", "idle");
    setLocalState("error", null);
  });

  // Get messages from SyncProvider and convert to ChatUIMessage format
  const messages = createMemo(() => {
    const sessionID = localState.sessionId;
    if (!sessionID) return [] as ChatUIMessage[];

    const allMessages: ChatUIMessage[] = [];
    const sessionMessages = data.message[sessionID] ?? [];
    for (const msg of sessionMessages) {
      const parts = data.part[msg.info.id] ?? [];
      const parentID =
        msg.info.role === "assistant" && "parentID" in msg.info ? msg.info.parentID : undefined;
      const sessionID = "sessionID" in msg.info ? msg.info.sessionID : undefined;
      const createdAt =
        "time" in msg.info && typeof msg.info.time?.created === "number"
          ? msg.info.time.created
          : undefined;
      const completedAt =
        msg.info.role === "assistant" &&
        "time" in msg.info &&
        typeof msg.info.time?.completed === "number"
          ? msg.info.time.completed
          : undefined;
      allMessages.push({
        id: msg.info.id,
        role: msg.info.role as "user" | "assistant",
        parts: parts as ChatUIMessage["parts"],
        metadata: (parentID || createdAt || completedAt
          ? {
              mode: "chat",
              sessionID,
              parentID,
              startedAt: createdAt,
              finishedAt: completedAt,
            }
          : undefined) as ChatUIMessage["metadata"],
      } as ChatUIMessage);
    }

    const ids = allMessages.map(message => message.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const signature = `${sessionID}|${allMessages
      .map(message => `${message.id}:${message.role}:${message.parts.length}`)
      .join(",")}`;

    if (DEBUG_CHAT_RENDER && signature !== lastMessageProjectionSignature) {
      console.log(`${DEBUG_PREFIX} useChat projected messages changed`, {
        sessionID,
        count: allMessages.length,
        messages: allMessages.map(message => ({
          id: message.id,
          role: message.role,
          parts: message.parts.length,
        })),
        duplicateIds,
      });
      lastMessageProjectionSignature = signature;
    }

    return allMessages;
  });

  createEffect(() => {
    const sessionID = localState.sessionId;
    if (!sessionID) return;
    const hasLocalMessages = data.message[sessionID] !== undefined;
    if (hasLocalMessages) {
      if (DEBUG_CHAT_RENDER) {
        console.log(`${DEBUG_PREFIX} useChat skip sync (local messages present)`, {
          sessionID,
          pendingSessionId,
          localMessageCount: data.message[sessionID]?.length ?? 0,
        });
      }
      return;
    }
    if (pendingSessionId && pendingSessionId === sessionID) {
      if (DEBUG_CHAT_RENDER) {
        console.log(`${DEBUG_PREFIX} useChat skip sync for pending session`, {
          sessionID,
          pendingSessionId,
        });
      }
      return;
    }
    if (DEBUG_CHAT_RENDER) {
      console.log(`${DEBUG_PREFIX} useChat trigger sync`, { sessionID, pendingSessionId });
    }
    void sync.session.sync(sessionID);
  });

  const sendMessage = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    const client = options.client as EkacodeApiClient | undefined;
    const workspace = options.workspace?.();

    if (!trimmed) return;
    if (!client || typeof workspace !== "string" || !workspace) {
      const error = new Error("Chat client is not ready");
      setLocalState("status", "error");
      setLocalState("error", error);
      onError?.(error);
      return;
    }

    const currentStatus = localState.status;
    if (currentStatus !== "idle" && currentStatus !== "done" && currentStatus !== "error") {
      return;
    }

    activeAbortController?.abort();
    const requestAbortController = new AbortController();
    activeAbortController = requestAbortController;

    // Update local state
    setLocalState("status", "connecting");
    setLocalState("error", null);
    streamDebugger.startCapture();

    try {
      // Get or create session ID
      let currentSessionId = localState.sessionId;
      if (!currentSessionId) {
        currentSessionId = uuidv7();
        pendingSessionId = currentSessionId;
        setLocalState("sessionId", currentSessionId);
      }

      // Optimistically add user message to store via SyncProvider
      const userMessageId = uuidv7();
      sync.session.addOptimisticMessage({
        sessionID: currentSessionId,
        messageID: userMessageId,
        text: trimmed,
      });

      const response = await client.chat(
        [
          {
            id: userMessageId,
            role: "user",
            parts: [{ type: "text", text: trimmed } as unknown as ChatUIMessage["parts"][number]],
          },
        ],
        {
          sessionId: currentSessionId,
          messageId: userMessageId,
          workspace,
          signal: requestAbortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newSessionId = response.headers.get("X-Session-ID");
      const resolvedSessionId = newSessionId ?? currentSessionId;
      if (DEBUG_CHAT_RENDER) {
        console.log(`${DEBUG_PREFIX} useChat chat response session`, {
          currentSessionId,
          newSessionId,
          resolvedSessionId,
          localSessionId: localState.sessionId,
        });
      }
      pendingSessionId = resolvedSessionId;
      if (newSessionId && newSessionId !== localState.sessionId) {
        setLocalState("sessionId", newSessionId);
      }
      options.onSessionIdReceived?.(resolvedSessionId);

      setLocalState("status", "streaming");

      // Note: We no longer parse the stream here
      // The event sync engine will populate the store via SSE events
      // This hook just initiates the request and handles completion

      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let rawBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            rawBuffer += decoder.decode(value, { stream: true });
            let newlineIndex = rawBuffer.indexOf("\n");
            while (newlineIndex >= 0) {
              const rawLine = rawBuffer.slice(0, newlineIndex);
              rawBuffer = rawBuffer.slice(newlineIndex + 1);
              if (rawLine.trim().length > 0) {
                streamDebugger.logRawLine(rawLine, store());
              }
              newlineIndex = rawBuffer.indexOf("\n");
            }
          }
          if (done) break;
        }

        const tail = rawBuffer + decoder.decode();
        if (tail.trim().length > 0) {
          streamDebugger.logRawLine(tail, store());
        }
      }

      setLocalState("status", "done");
      setLocalState("rlmState", null);

      const assistantMessages = messages().filter(m => m.role === "assistant");
      const lastMessage =
        assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : undefined;
      if (lastMessage) {
        onFinish?.(lastMessage);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        logger.error("Chat request failed", error as Error);
        setLocalState("status", "error");
        setLocalState("error", error as Error);
        onError?.(error as Error);
        streamDebugger.logEvent({
          type: "error",
          payload: { error: (error as Error).message },
          storeSnapshot: store(),
        });
      }
    } finally {
      streamDebugger.endCapture();
      if (activeAbortController === requestAbortController) {
        activeAbortController = null;
      }
    }
  };

  const stop = (): void => {
    activeAbortController?.abort();
    activeAbortController = null;
    setLocalState("status", "idle");
  };

  const status = () => localState.status;
  const error = () => localState.error;
  const rlmState = () => localState.rlmState;
  const sessionId = () => localState.sessionId;

  const isLoading = createMemo(() => {
    const s = status();
    return s === "connecting" || s === "streaming" || s === "processing";
  });

  const canSend = createMemo(() => {
    const s = status();
    return s === "idle" || s === "done" || s === "error";
  });

  const store = createMemo<ChatState>(() => {
    const list = messages();
    const byId = Object.fromEntries(list.map(message => [message.id, message]));
    const order = list.map(message => message.id);
    return {
      messages: { byId, order },
      events: { byId: {}, order: [] },
      reasoning: { byId: {} },
      status: status(),
      error: error(),
      rlmState: rlmState(),
      sessionId: sessionId(),
      currentMetadata: null,
    };
  });

  return {
    get store() {
      return store();
    },
    messages,
    status,
    error,
    isLoading,
    canSend,
    rlmState,
    sessionId,
    sendMessage,
    stop,
    streamDebugger,
  };
}
