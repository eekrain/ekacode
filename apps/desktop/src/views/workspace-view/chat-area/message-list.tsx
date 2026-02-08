import { Component, createEffect, createMemo, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { ThinkingBubble } from "./message-bubble";
import { SessionTurn } from "./session-turn";
import { Icon } from "/@/components/icon";
import { createAutoScroll } from "/@/hooks/create-auto-scroll";
import { cn } from "/@/lib/utils";
import type { Message } from "/@/providers/global-sync-provider";
import { useSync } from "/@/providers/sync-provider";

interface MessageListProps {
  /** Current session ID */
  sessionId?: string;
  /** Whether AI is currently generating */
  isGenerating?: boolean;
  /** Current thinking content (if any) */
  thinkingContent?: string;
  /** Additional CSS classes */
  class?: string;
  /** Callback when messages are scrolled to bottom */
  onScrollToBottom?: () => void;
}

// Stable empty constants to prevent re-renders
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_IDS: string[] = [];
const IDLE_STATUS = { type: "idle" } as const;

// Custom equality for string ID arrays
function idsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

/**
 * MessageList - Scrollable message area with smart auto-scroll
 *
 * Design Features:
 * - Smart auto-scroll that pauses when user scrolls up
 * - Smooth scroll to bottom on new messages
 * - Typing indicator when generating
 * - Collapsible thought blocks
 * - Tool execution indicators
 * - Custom scrollbar styling
 * - Visual indicator when auto-scroll is paused
 */
export const MessageList: Component<MessageListProps> = props => {
  const sync = useSync();
  const [expanded, setExpanded] = createStore<Record<string, boolean>>({});

  const autoScroll = createAutoScroll({
    working: () => props.isGenerating ?? false,
    nearBottomDistance: 100,
    settlingPeriod: 300,
  });

  // Get messages for current session from store
  const sessionMessages = createMemo(() => {
    const sessionID = props.sessionId;
    if (!sessionID) return EMPTY_MESSAGES;
    return sync.data.message[sessionID] ?? EMPTY_MESSAGES;
  }, EMPTY_MESSAGES);

  // Compute timeline as array of user message IDs only
  // Each user message ID represents a turn - SessionTurn will fetch its own data
  const userMessageIDs = createMemo(
    () => {
      const messages = sessionMessages();
      if (messages.length === 0) return EMPTY_IDS;
      const ids: string[] = [];
      for (const msg of messages) {
        if (msg.info.role === "user") {
          ids.push(msg.info.id);
        }
      }
      return ids.length > 0 ? ids : EMPTY_IDS;
    },
    EMPTY_IDS,
    { equals: idsEqual }
  );

  const sessionStatus = createMemo(() => {
    const id = props.sessionId;
    if (!id) return IDLE_STATUS;
    return sync.data.sessionStatus[id]?.status ?? IDLE_STATUS;
  });

  // Determine last user message ID for "isLast" prop
  const lastUserMessageID = createMemo(() => {
    const ids = userMessageIDs();
    return ids[ids.length - 1];
  });

  createEffect(() => {
    const lastID = lastUserMessageID();
    if (!lastID) return;
    const status = sessionStatus();
    const isWorking = (props.isGenerating ?? false) || status.type !== "idle";
    setExpanded(lastID, isWorking);
  });

  return (
    <div
      ref={autoScroll.scrollRef}
      onScroll={e => autoScroll.handleScroll(e.currentTarget)}
      class={cn("scrollbar-thin flex-1 overflow-y-auto", "px-4 py-4", props.class)}
    >
      {/* Messages */}
      <div class="mx-auto max-w-3xl">
        <For each={userMessageIDs()}>
          {messageID => (
            <div class="group mb-5">
              <SessionTurn
                sessionID={props.sessionId}
                messageID={messageID}
                isLast={messageID === lastUserMessageID()}
                expanded={expanded[messageID] ?? false}
                onToggleExpanded={() => setExpanded(messageID, value => !value)}
              />
            </div>
          )}
        </For>

        {/* Current thinking (while generating) */}
        <Show when={props.isGenerating && props.thinkingContent}>
          <ThinkingBubble content={props.thinkingContent || ""} />
        </Show>

        {/* Typing indicator */}
        <Show when={props.isGenerating && !props.thinkingContent}>
          <div class={cn("mb-4 flex items-center gap-2", "animate-fade-in-up")}>
            <div class={cn("rounded-xl px-4 py-3", "bg-card/30 border-border/30 border")}>
              <div class="flex gap-1">
                <span class="typing-dot bg-primary/60 h-2 w-2 rounded-full" />
                <span class="typing-dot bg-primary/60 h-2 w-2 rounded-full" />
                <span class="typing-dot bg-primary/60 h-2 w-2 rounded-full" />
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Scroll to bottom button (when not auto-scrolling) */}
      <Show when={!autoScroll.isAutoScrolling()}>
        <button
          onClick={() => {
            autoScroll.setAutoScrolling(true);
            autoScroll.scrollToBottom(true);
          }}
          class={cn(
            "fixed bottom-24 right-8 z-10",
            "rounded-lg p-2",
            "bg-card/80 border-border/40 glass-effect border backdrop-blur-sm",
            "hover:bg-card hover:border-primary/30",
            "shadow-lg transition-all duration-200",
            "hover:scale-105"
          )}
          aria-label="Scroll to bottom"
        >
          <Icon name="chevron-down" class="text-foreground/60 h-5 w-5" />
        </button>
      </Show>
    </div>
  );
};
