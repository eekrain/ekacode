import { Component, createEffect, For, Show } from "solid-js";
import { MessageBubble, ThinkingBubble } from "./message-bubble";
import { AssistantMessage } from "/@/components/assistant-message";
import { Icon } from "/@/components/icon";
import { createAutoScroll } from "/@/hooks/create-auto-scroll";
import { cn } from "/@/lib/utils";
import type { ChatUIMessage } from "/@/types/ui-message";

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
  const autoScroll = createAutoScroll({
    working: () => props.isGenerating ?? false,
    nearBottomDistance: 100,
    settlingPeriod: 300,
  });

  createEffect(() => console.log(props.messages));

  return (
    <div
      ref={autoScroll.scrollRef}
      onScroll={e => autoScroll.handleScroll(e.currentTarget)}
      class={cn("scrollbar-thin flex-1 overflow-y-auto", "px-4 py-4", props.class)}
    >
      {/* Messages */}
      <div class="mx-auto max-w-3xl">
        <For each={props.messages}>
          {(message, index) => (
            <div class="group">
              {/* Use AssistantMessage for assistant messages, MessageBubble for user messages */}
              <Show
                when={message.role === "assistant"}
                fallback={<MessageBubble message={message} delay={Math.min(index() * 50, 300)} />}
              >
                <AssistantMessage message={message} />
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
