/**
 * Reasoning Part Component - Agent thinking display
 *
 * Displays agent reasoning/thinking content with collapsible display.
 */

import type { ReasoningPart as ReasoningPartType } from "@ekacode/core/chat";
import { Show, createSignal, type JSX } from "solid-js";
import type { MessagePartProps, PartComponent } from "../message-part";
import { createThrottledValue } from "./text-part";

/**
 * Reasoning part display component
 *
 * Shows agent thinking/reasoning in a collapsible container.
 * Uses throttled rendering to prevent UI jank during streaming.
 */
export const ReasoningPartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as ReasoningPartType;
  const [expanded, setExpanded] = createSignal(true);

  // Get text content
  const getText = () => (part.text ?? "").trim();

  // Create throttled text signal
  const throttledText = createThrottledValue(getText);

  return (
    <Show when={throttledText()}>
      <div data-component="reasoning-part" class="my-2 border-l-2 border-purple-500 pl-3">
        <button
          data-slot="reasoning-header"
          class="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
          onClick={() => setExpanded(!expanded())}
        >
          <span class="transition-transform">{expanded() ? "▼" : "▶"}</span>
          <span>Thinking</span>
          <Show when={part.time}>
            <span class="text-xs opacity-70">
              {part.time.end
                ? `${Math.round((part.time.end - part.time.start) / 1000)}s`
                : "thinking..."}
            </span>
          </Show>
        </button>
        <Show when={expanded()}>
          <div
            data-slot="reasoning-content"
            class="text-muted-foreground mt-2 whitespace-pre-wrap text-sm"
          >
            {throttledText()}
          </div>
        </Show>
      </div>
    </Show>
  );
};
