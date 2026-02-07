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
import type { UseStreamDebuggerResult } from "./use-stream-debugger";

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

  const streamDebugger = {
    state: "disabled" as const,
    events: () => [],
    rawLines: () => [],
    metrics: () => ({ events: 0, bytes: 0, duration: 0 }),
    isCapturing: () => false,
    logEvent: () => {},
    logRawLine: () => {},
    startCapture: () => {},
    endCapture: () => {},
    clear: () => {},
  } as unknown as UseStreamDebuggerResult;

  let abortController: AbortController | null = null;

  onCleanup(() => {
    abortController?.abort();
  });

  createEffect(() => {
    if (!options.sessionId) return;

    const externalSessionId = options.sessionId() ?? null;
    if (externalSessionId === localState.sessionId) return;

    abortController?.abort();
    abortController = null;
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
      allMessages.push({
        id: msg.info.id,
        role: msg.info.role as "user" | "assistant",
        parts: parts as ChatUIMessage["parts"],
      } as ChatUIMessage);
    }
    return allMessages;
  });

  createEffect(() => {
    const sessionID = localState.sessionId;
    if (!sessionID) return;
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

    abortController?.abort();
    abortController = new AbortController();

    // Update local state
    setLocalState("status", "connecting");
    setLocalState("error", null);

    try {
      // Get or create session ID
      let currentSessionId = localState.sessionId;
      if (!currentSessionId) {
        currentSessionId = uuidv7();
        setLocalState("sessionId", currentSessionId);
        options.onSessionIdReceived?.(currentSessionId);
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
          workspace,
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newSessionId = response.headers.get("X-Session-ID");
      if (newSessionId && newSessionId !== localState.sessionId) {
        setLocalState("sessionId", newSessionId);
        options.onSessionIdReceived?.(newSessionId);
      }

      setLocalState("status", "streaming");

      // Note: We no longer parse the stream here
      // The event sync engine will populate the store via SSE events
      // This hook just initiates the request and handles completion

      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
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
      }
    } finally {
      abortController = null;
    }
  };

  const stop = (): void => {
    abortController?.abort();
    abortController = null;
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

  // Create a mock store object for compatibility with existing ChatState interface
  const store = createMemo<ChatState>(() => ({
    messages: { byId: {}, order: [] },
    events: { byId: {}, order: [] },
    reasoning: { byId: {} },
    status: status(),
    error: error(),
    rlmState: rlmState(),
    sessionId: sessionId(),
    currentMetadata: null,
  }));

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
