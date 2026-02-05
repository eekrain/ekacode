/**
 * useChat Hook
 *
 * Main chat hook for integrating with the Hono server.
 * Uses correct Solid.js primitives - no React-style dependency arrays.
 *
 * Features:
 * - Streaming chat with AbortController
 * - TRUE O(1) message updates via normalized store (order + byId)
 * - Session ID management
 * - RLM state tracking
 * - Cleanup on unmount
 * - Comprehensive logging
 *
 * Architecture:
 * Messages are stored in a normalized structure { order: string[], byId: Record<string, Message> }
 * This allows direct key lookup instead of O(N) array scanning, critical for 50-100 tokens/sec streams.
 */
import { createMemo, onCleanup, type Accessor } from "solid-js";
import { EkacodeApiClient } from "../lib/api-client";
import { createChatStore } from "../lib/chat/store";
import { parseUIMessageStream } from "../lib/chat/stream-parser";
import { createLogger } from "../lib/logger";
import type {
  ChatMessageMetadata,
  ChatState,
  ChatStatus,
  ChatUIMessage,
  RLMStateData,
} from "../types/ui-message";
import type { UseStreamDebuggerResult } from "./use-stream-debugger";
import { useStreamDebugger } from "./use-stream-debugger";

const logger = createLogger("desktop:chat");

/**
 * Options for useChat hook
 */
export interface UseChatOptions {
  /** API client instance */
  client: EkacodeApiClient;

  /** Workspace directory (reactive accessor) */
  workspace: Accessor<string>;

  /** Initial messages for the conversation */
  initialMessages?: ChatUIMessage[];

  /** Initial session ID (for resuming conversations) */
  initialSessionId?: string;

  /** Called when an error occurs */
  onError?: (error: Error) => void;

  /** Called when a response is complete */
  onFinish?: (message: ChatUIMessage) => void;

  /** Called when RLM state changes during streaming */
  onRLMStateChange?: (state: RLMStateData) => void;

  /** Called when session ID is received from server */
  onSessionIdReceived?: (sessionId: string) => void;
}

/**
 * Result returned by useChat hook
 */
export interface UseChatResult {
  /** The full store state (reactive) */
  store: ChatState;

  /** Messages accessor (reactive) */
  messages: Accessor<ChatUIMessage[]>;

  /** Current status accessor */
  status: Accessor<ChatStatus>;

  /** Current error accessor */
  error: Accessor<Error | null>;

  /** Whether currently loading/streaming */
  isLoading: Accessor<boolean>;

  /** Whether user can send a message */
  canSend: Accessor<boolean>;

  /** Current RLM state accessor */
  rlmState: Accessor<RLMStateData | null>;

  /** Current session ID accessor */
  sessionId: Accessor<string | null>;

  /**
   * Send a message to the agent
   * @param text - Message text content
   */
  sendMessage: (text: string) => Promise<void>;

  /** Stop the current generation */
  stop: () => void;

  /** Clear all messages */
  clearMessages: () => void;

  /** Set session ID manually */
  setSessionId: (id: string | null) => void;

  /** Stream debugger instance for development */
  streamDebugger: UseStreamDebuggerResult;
}

/**
 * Main chat hook for desktop-agent integration
 *
 * Uses a normalized message store internally for true O(1) streaming updates.
 * At 50-100 tokens/sec, this prevents UI lag from O(N) message lookups.
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const workspace = () => "/path/to/project";
 *   const chat = useChat({ client, workspace });
 *
 *   return (
 *     <div>
 *       <For each={chat.messages()}>
 *         {(msg) => <Message message={msg} />}
 *       </For>
 *       <input
 *         onKeyDown={(e) => {
 *           if (e.key === "Enter" && chat.canSend()) {
 *             chat.sendMessage(e.currentTarget.value);
 *           }
 *         }}
 *         disabled={!chat.canSend()}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(options: UseChatOptions): UseChatResult {
  const {
    client,
    workspace,
    initialMessages = [],
    initialSessionId,
    onError,
    onFinish,
    onRLMStateChange,
  } = options;

  logger.info("useChat hook initialized", {
    initialMessageCount: initialMessages.length,
    initialSessionId,
  });

  // Create the chat store
  const chatStore = createChatStore(initialMessages);

  // Create stream debugger for development
  const streamDebugger = useStreamDebugger();

  // Set initial session ID if provided
  if (initialSessionId) {
    chatStore.setSessionId(initialSessionId);
  }

  // Abort controller for cancellation
  let abortController: AbortController | null = null;

  // Track streaming message IDs (preamble → activity → final)
  let preambleMessageId: string | null = null;
  let activityMessageId: string | null = null;
  let finalMessageId: string | null = null;
  let hasToolCalls = false;
  let bufferedText = "";
  let messageCounter = 0;

  const nextMessageId = () =>
    `msg_${Date.now()}_${messageCounter++}_${Math.random().toString(36).slice(2, 11)}`;

  const ensurePreambleMessage = () => {
    if (!preambleMessageId) {
      preambleMessageId = nextMessageId();
      const assistantMessage: ChatUIMessage = {
        id: preambleMessageId,
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };
      chatStore.addMessage(assistantMessage);
    }
    return preambleMessageId;
  };

  const ensureActivityMessage = () => {
    if (!activityMessageId) {
      activityMessageId = nextMessageId();
      const assistantMessage: ChatUIMessage = {
        id: activityMessageId,
        role: "assistant",
        parts: [],
      };
      chatStore.addMessage(assistantMessage);
      chatStore.setMessageMetadata(activityMessageId, { mode: "build" });
    }
    return activityMessageId;
  };

  const ensureFinalMessage = () => {
    if (!finalMessageId) {
      finalMessageId = nextMessageId();
      const assistantMessage: ChatUIMessage = {
        id: finalMessageId,
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };
      chatStore.addMessage(assistantMessage);
    }
    return finalMessageId;
  };

  // Cleanup on unmount
  onCleanup(() => {
    logger.debug("useChat hook cleanup");
    abortController?.abort();
  });

  /**
   * Send a message to the agent
   */
  const sendMessage = async (text: string): Promise<void> => {
    // Can't send while already streaming
    if (!canSend()) {
      logger.warn("Message send blocked - chat not ready", { status: chatStore.get().status });
      return;
    }

    logger.info("[USE-CHAT] Sending message", { length: text.length, workspace: workspace() });

    // Abort any existing request
    abortController?.abort();
    abortController = new AbortController();

    // Add user message
    const userMessage: ChatUIMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text }],
    };
    logger.info("[USE-CHAT] Adding user message", { messageId: userMessage.id });
    chatStore.addMessage(userMessage);
    logger.info("[USE-CHAT] User message added, current count", {
      count: chatStore.getMessageCount(),
    });

    // Reset per-request tracking
    preambleMessageId = null;
    activityMessageId = null;
    finalMessageId = null;
    hasToolCalls = false;
    bufferedText = "";
    messageCounter = 0;
    const preambleId = ensurePreambleMessage();
    chatStore.setStatus("connecting");
    chatStore.setError(null);

    // Start stream debugger capture
    streamDebugger.startCapture();
    streamDebugger.logEvent({
      type: "message-start",
      messageId: userMessage.id,
      payload: { text: text.slice(0, 100) },
      storeSnapshot: chatStore.get(),
    });

    try {
      // Make the request
      const response = await client.chat(chatStore.getMessagesForNetwork(), {
        sessionId: chatStore.get().sessionId ?? undefined,
        workspace: workspace(),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check for session ID in response header
      const newSessionId = response.headers.get("X-Session-ID");
      if (newSessionId && newSessionId !== chatStore.get().sessionId) {
        logger.info("New session ID received", { sessionId: newSessionId });
        chatStore.setSessionId(newSessionId);
        options.onSessionIdReceived?.(newSessionId);
      }

      chatStore.setStatus("streaming");

      // Parse the stream
      await parseUIMessageStream(response, {
        onTextDelta: (messageId, delta) => {
          // Determine the actual target message ID
          let actualMessageId: string;

          if (messageId && messageId !== preambleMessageId && messageId !== activityMessageId) {
            // Server provided a specific message ID
            actualMessageId = messageId;
            const existingMessage = chatStore.getMessage(messageId);
            if (!existingMessage) {
              // Create new message with server ID
              const assistantMessage: ChatUIMessage = {
                id: messageId,
                role: "assistant",
                parts: [{ type: "text", text: delta }],
              };
              chatStore.addMessage(assistantMessage);
              if (!preambleMessageId) preambleMessageId = messageId;
            }
          } else if (!hasToolCalls) {
            actualMessageId = ensurePreambleMessage();
            chatStore.appendTextDelta(actualMessageId, delta);
          } else {
            actualMessageId = ensureFinalMessage();
            bufferedText += delta;
          }

          // Log to debugger with the actual message ID
          streamDebugger.logEvent({
            type: "text-delta",
            messageId: actualMessageId,
            payload: { delta: delta.slice(0, 100) },
            storeSnapshot: chatStore.get(),
          });
        },

        onToolCallStart: toolCall => {
          logger.debug("Tool call started", {
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });

          hasToolCalls = true;
          const targetId = ensureActivityMessage();
          chatStore.setMessageMetadata(targetId, { mode: "build" });
          chatStore.addToolCall(targetId, {
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: {},
          });

          // Log to debugger with the activity message ID
          streamDebugger.logEvent({
            type: "tool-call-start",
            messageId: targetId,
            payload: toolCall,
            storeSnapshot: chatStore.get(),
          });
        },

        onToolCallEnd: (toolCallId, args) => {
          const targetId = ensureActivityMessage();
          chatStore.updateToolCall(targetId, toolCallId, args);

          // Log to debugger with the activity message ID
          streamDebugger.logEvent({
            type: "tool-call-end",
            messageId: targetId,
            payload: { toolCallId, args },
            storeSnapshot: chatStore.get(),
          });
        },

        onToolResult: result => {
          logger.debug("Tool result received", { toolCallId: result.toolCallId });

          const targetId = ensureActivityMessage();
          chatStore.addToolResult(targetId, result);

          // Log to debugger with the activity message ID
          streamDebugger.logEvent({
            type: "tool-result",
            messageId: targetId,
            payload: result,
            storeSnapshot: chatStore.get(),
          });
        },

        onDataPart: (type, id, data, transient) => {
          if (type === "data-session") {
            const sessionData = data as { sessionId: string };
            chatStore.setSessionId(sessionData.sessionId);

            // Log session data without message ID
            streamDebugger.logEvent({
              type: "data-part",
              payload: { type, id, data, transient },
              storeSnapshot: chatStore.get(),
            });
            return;
          }

          const isUiData = type.startsWith("data-");
          const targetId = isUiData ? ensureActivityMessage() : ensurePreambleMessage();

          // Update data part in message
          chatStore.updateDataPart(targetId, type, id, data, transient);

          // Log to debugger with the appropriate message ID
          streamDebugger.logEvent({
            type: "data-part",
            messageId: targetId,
            payload: { type, id, data, transient },
            storeSnapshot: chatStore.get(),
          });

          // Extract RLM state for easy access
          if (type === "data-rlm-state") {
            const rlmState = data as RLMStateData;
            chatStore.setRLMState(rlmState);
            onRLMStateChange?.(rlmState);
          } else if (type === "data-mode-metadata") {
            // Extract mode metadata for mode-based UI routing
            // Trust server metadata - don't override with client-side heuristics
            const metadata = data as ChatMessageMetadata;
            const modeTargetId = ensureActivityMessage();
            chatStore.setMessageMetadata(modeTargetId, metadata);
          } else if (type === "data-action" || type === "data-thought") {
            chatStore.setMessageMetadata(targetId, { mode: "build" });
          }
        },

        onError: error => {
          logger.error("Stream error in chat", error);

          // Log to debugger
          streamDebugger.logEvent({
            type: "error",
            payload: { message: error.message, stack: error.stack },
            storeSnapshot: chatStore.get(),
          });
          streamDebugger.endCapture();

          chatStore.setStatus("error");
          chatStore.setError(error);
          onError?.(error);
        },

        onComplete: () => {
          logger.info("Chat response completed");

          // Log to debugger
          streamDebugger.logEvent({
            type: "complete",
            payload: { messageCount: chatStore.getMessageCount() },
            storeSnapshot: chatStore.get(),
          });
          streamDebugger.endCapture();

          chatStore.setStatus("done");
          chatStore.setRLMState(null);

          if (bufferedText.trim()) {
            const targetId = ensureFinalMessage();
            chatStore.appendTextDelta(targetId, bufferedText);
          }

          if (preambleId) {
            const preamble = chatStore.getMessage(preambleId);
            const preambleText = preamble?.parts
              .filter(part => part.type === "text")
              .map(part => (part as { text?: string }).text ?? "")
              .join("");
            if (!preambleText || preambleText.trim().length === 0) {
              chatStore.removeMessage(preambleId);
            }
          }

          const lastMessage = finalMessageId
            ? chatStore.getMessage(finalMessageId)
            : chatStore.getLastMessage();
          if (lastMessage) onFinish?.(lastMessage);
        },
      });
    } catch (error) {
      // Don't report abort as error
      if ((error as Error).name !== "AbortError") {
        logger.error("Chat request failed", error as Error);

        // Log to debugger
        streamDebugger.logEvent({
          type: "error",
          payload: {
            message: (error as Error).message,
            stack: (error as Error).stack,
            name: (error as Error).name,
          },
          storeSnapshot: chatStore.get(),
        });
        streamDebugger.endCapture();

        chatStore.setStatus("error");
        chatStore.setError(error as Error);
        onError?.(error as Error);
      }
    } finally {
      abortController = null;
      preambleMessageId = null;
      activityMessageId = null;
      finalMessageId = null;
    }
  };

  /**
   * Stop current generation
   */
  const stop = () => {
    logger.info("Stopping chat generation");
    abortController?.abort();
    abortController = null;
    chatStore.setStatus("idle");
  };

  /**
   * Clear all messages
   */
  const clearMessages = () => {
    logger.info("Clearing all messages");
    chatStore.clear();
  };

  /**
   * Set session ID
   */
  const setSessionId = (id: string | null) => {
    logger.info("Setting session ID", { sessionId: id ?? undefined });
    chatStore.setSessionId(id);
  };

  // Computed accessors
  const status = () => chatStore.get().status;
  const error = () => chatStore.get().error;

  const isLoading = createMemo(() => {
    const s = status();
    return s === "connecting" || s === "streaming" || s === "processing";
  });

  const canSend = createMemo(() => {
    const s = status();
    return s === "idle" || s === "done" || s === "error";
  });

  const rlmState = () => chatStore.get().rlmState;
  const sessionId = () => chatStore.get().sessionId;

  return {
    store: chatStore.get(),
    messages: () => chatStore.getMessagesArray(),
    status,
    error,
    isLoading,
    canSend,
    rlmState,
    sessionId,
    sendMessage,
    stop,
    clearMessages,
    setSessionId,
    streamDebugger,
  };
}
