/**
 * SessionTurn Component
 *
 * Renders a single turn (user message + assistant response) in the timeline.
 */

import type { ChatTurn } from "@/core/chat/hooks/turn-projection";
import { Show, type Accessor, type JSX } from "solid-js";

export interface SessionTurnProps {
  turn: Accessor<ChatTurn>;
  isStreaming: Accessor<boolean>;
  onRetry?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (messageId: string) => void;
  class?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getUserText(turn: ChatTurn): string {
  const textPart = turn.userParts.find(p => p.type === "text");
  if (textPart && typeof textPart.text === "string") {
    return textPart.text;
  }
  return "";
}

function getAssistantText(turn: ChatTurn): string {
  if (turn.finalTextPart && typeof turn.finalTextPart.text === "string") {
    return turn.finalTextPart.text;
  }
  return "";
}

function getLastAssistantMessageId(turn: ChatTurn): string | undefined {
  return turn.assistantMessages[turn.assistantMessages.length - 1]?.id;
}

export function SessionTurn(props: SessionTurnProps): JSX.Element {
  const turn = props.turn;

  return (
    <div
      data-component="session-turn"
      data-slot="session-turn-root"
      class={props.class}
      classList={{
        "flex flex-col gap-3": true,
      }}
    >
      <div data-slot="session-turn-user" class="bg-muted/30 rounded-lg p-3">
        <div class="text-muted-foreground mb-1 text-xs">You</div>
        <div class="text-sm">{getUserText(turn())}</div>
      </div>

      <Show when={turn().working}>
        <div
          data-slot="session-turn-status"
          class="text-muted-foreground flex items-center gap-2 px-3 text-xs"
        >
          <div class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{turn().statusLabel ?? "Working"}</span>
          <span>·</span>
          <span>{formatDuration(turn().durationMs)}</span>
        </div>
      </Show>

      <Show when={turn().assistantMessages.length > 0}>
        <div data-slot="session-turn-summary" class="px-3">
          <Show when={turn().error && !turn().working}>
            <div class="bg-destructive/10 text-destructive mb-3 rounded-lg p-3 text-sm">
              {turn().error}
            </div>
          </Show>

          <Show when={getAssistantText(turn())}>
            <div class="whitespace-pre-wrap text-sm" aria-live={turn().working ? "polite" : "off"}>
              {getAssistantText(turn())}
            </div>
          </Show>

          <Show when={!turn().working}>
            <div class="mt-3 flex items-center gap-2">
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs"
                onClick={() => props.onRetry?.(turn().userMessage.id)}
              >
                Retry
              </button>
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs"
                onClick={() => {
                  const assistantId = getLastAssistantMessageId(turn()) ?? turn().userMessage.id;
                  props.onCopy?.(assistantId);
                }}
              >
                Copy
              </button>
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs"
                onClick={() => props.onDelete?.(turn().userMessage.id)}
              >
                Delete
              </button>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={turn().assistantMessages.length === 0 && turn().working}>
        <div class="text-muted-foreground flex items-center justify-center py-8 text-sm">
          Waiting for response...
        </div>
      </Show>
    </div>
  );
}
