import { Component, createEffect, createSignal, For, onMount, Show } from "solid-js";
import { MessageBubble, ThinkingBubble } from "./message-bubble";
import { ToolCallBlock } from "./tool-call-block";
import { createLogger } from "/@/lib/logger";
import { cn } from "/@/lib/utils";
import type { ChatUIMessage } from "/@/types/ui-message";

const logger = createLogger("desktop:msglist");

interface MessageListProps {
  /** Messages to display */
  messages: ChatUIMessage[];
  /** Whether AI is currently generating */
  isGenerating?: boolean;
  /** Current thinking content (if any) */
  thinkingContent?: string;
  /** Additional CSS classes */
  class?: string;
  /** Callback when messages are scrolled to bottom */
  onScrollToBottom?: () => void;
}

/**
 * MessageList - Scrollable message area with auto-scroll
 *
 * Design Features:
 * - Smooth scroll to bottom on new messages
 * - Typing indicator when generating
 * - Collapsible thought blocks
 * - Tool execution indicators
 * - Custom scrollbar styling
 */
export const MessageList: Component<MessageListProps> = props => {
  let messagesEndRef: HTMLDivElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  const [shouldAutoScroll, setShouldAutoScroll] = createSignal(true);

  // Scroll to bottom when messages change
  const scrollToBottom = (smooth = true) => {
    if (!shouldAutoScroll()) return;
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  };

  // Check if user is scrolling up
  const handleScroll = () => {
    if (!containerRef) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Auto-scroll if near bottom (within 100px)
    setShouldAutoScroll(distanceFromBottom < 100);
  };

  onMount(() => {
    scrollToBottom(false);
  });

  // Scroll to bottom when messages change
  createEffect(() => {
    const _messages = props.messages;
    logger.info("[MSG-LIST] Messages updated", {
      count: _messages.length,
      lastMessage: _messages[_messages.length - 1]?.id,
      lastMessageRole: _messages[_messages.length - 1]?.role,
    });
    if (shouldAutoScroll()) {
      setTimeout(() => scrollToBottom(true), 50);
    }
  });

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      class={cn("scrollbar-thin flex-1 overflow-y-auto", "px-4 py-4", props.class)}
    >
      {/* Messages */}
      <div class="mx-auto max-w-3xl">
        <For each={props.messages}>
          {(message, index) => (
            <div class="group">
              <MessageBubble message={message} delay={Math.min(index() * 50, 300)} />

              {/* Tool calls - extracted from parts */}
              <Show
                when={message.parts?.some(
                  part => part.type === "tool-call" || part.type === "tool-result"
                )}
              >
                <div class="ml-12 mt-2 space-y-1">
                  <For each={message.parts}>
                    {part =>
                      part.type === "tool-call" ? (
                        <ToolCallBlock
                          toolCall={{
                            id: (part as unknown as { toolCallId: string }).toolCallId,
                            name: (part as unknown as { toolName?: string }).toolName || "unknown",
                            arguments:
                              ((part as unknown as { args?: Record<string, unknown> })
                                .args as Record<string, unknown>) || {},
                            status: "pending",
                            timestamp: new Date(),
                          }}
                        />
                      ) : null
                    }
                  </For>
                </div>
              </Show>
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

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button (when not auto-scrolling) */}
      <Show when={!shouldAutoScroll()}>
        <button
          onClick={() => {
            setShouldAutoScroll(true);
            scrollToBottom(true);
          }}
          class={cn(
            "fixed bottom-24 right-8 z-10",
            "rounded-lg p-2",
            "bg-card/80 border-border/40 border backdrop-blur-sm",
            "hover:bg-card hover:border-primary/30",
            "shadow-lg transition-all duration-200",
            "hover:scale-105"
          )}
          aria-label="Scroll to bottom"
        >
          <svg
            class="text-foreground/60 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      </Show>
    </div>
  );
};
