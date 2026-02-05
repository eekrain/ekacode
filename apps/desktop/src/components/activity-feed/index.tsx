/**
 * ActivityFeed Component (Build Mode)
 *
 * Chronological timeline of agent events for build mode.
 * Shows all events in a flat list with timestamps.
 */

import { For, Show, createMemo, type Component } from "solid-js";
import type { AgentEvent, ChatUIMessage, ThoughtData } from "../../types/ui-message";
import { MessageParts } from "../message-parts";
import { ActionRow } from "./action-row";
import { ThoughtIndicator } from "./thought-indicator";

export interface ActivityFeedProps {
  message: ChatUIMessage;
}

/**
 * Extract all events from message parts
 */
function extractEvents(message: ChatUIMessage): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const part of message.parts) {
    const partType = (part as { type?: string }).type;
    if (partType === "data-action" || partType === "data-data-action") {
      events.push((part as unknown as { type: string; data: AgentEvent }).data);
    }
  }
  return events.sort((a, b) => a.ts - b.ts);
}

/**
 * Extract active thought data if any
 */
function extractThought(message: ChatUIMessage): ThoughtData | null {
  for (const part of message.parts) {
    const partType = (part as { type?: string }).type;
    if (partType === "data-thought" || partType === "data-data-thought") {
      return (part as unknown as { type: string; data: ThoughtData }).data;
    }
  }
  return null;
}

/**
 * Check if message has text content
 */
function hasTextContent(message: ChatUIMessage): boolean {
  return message.parts.some(part => part.type === "text" && part.text.trim());
}

export const ActivityFeed: Component<ActivityFeedProps> = props => {
  const events = createMemo(() => extractEvents(props.message));
  const thought = createMemo(() => extractThought(props.message));
  const showText = createMemo(() => hasTextContent(props.message));
  const textParts = createMemo(
    () =>
      props.message.parts.filter(part => part.type === "text") as readonly {
        type: string;
        text?: string;
        [key: string]: unknown;
      }[]
  );
  const toolParts = createMemo(
    () =>
      props.message.parts.filter(
        part => part.type === "tool-call" || part.type === "tool-result"
      ) as readonly {
        type: string;
        [key: string]: unknown;
      }[]
  );

  return (
    <div class="animate-fade-in-up">
      {/* Thought Indicator (if thinking) */}
      <Show when={thought()}>
        <ThoughtIndicator
          status={thought()!.status}
          durationMs={thought()!.durationMs}
          text={thought()!.text}
        />
      </Show>

      {/* Tool activity (preferred) */}
      <Show when={toolParts().length > 0}>
        <div class="my-3">
          <MessageParts parts={toolParts()} class="space-y-2" />
        </div>
      </Show>

      {/* Fallback event timeline (when no tool parts exist) */}
      <Show when={toolParts().length === 0 && events().length > 0}>
        <div class="my-3 space-y-0.5">
          <For each={events()}>{event => <ActionRow event={event} />}</For>
        </div>
      </Show>

      {/* Text Content (markdown response) */}
      <Show when={showText()}>
        <div class="mt-3">
          <MessageParts parts={textParts()} />
        </div>
      </Show>
    </div>
  );
};

export default ActivityFeed;
