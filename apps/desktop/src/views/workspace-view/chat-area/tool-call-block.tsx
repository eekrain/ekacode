import { Component, Show, createSignal } from "solid-js";
import { cn } from "/@/lib/utils";
import type { ToolCall } from "/@/types";

interface ToolCallBlockProps {
  /** Tool call data */
  toolCall: ToolCall;
  /** Additional CSS classes */
  class?: string;
}

/**
 * ToolCallBlock - Display tool execution with status indicators
 *
 * Design Features:
 * - Status-based color coding (pending/running/completed/failed)
 * - Animated spinner for running state
 * - Checkmark for completed
 * - X for failed
 * - Expandable to show arguments/result
 */
export const ToolCallBlock: Component<ToolCallBlockProps> = props => {
  const [isExpanded] = createSignal(true);

  const statusConfig = () => {
    switch (props.toolCall.status) {
      case "pending":
        return {
          icon: "clock",
          color: "text-muted-foreground/50",
          bg: "bg-muted/20",
          label: "Pending",
        };
      case "running":
        return {
          icon: "spinner",
          color: "text-primary animate-spin",
          bg: "bg-primary/10",
          label: "Running",
        };
      case "completed":
        return {
          icon: "check",
          color: "text-green-500",
          bg: "bg-green-500/10",
          label: "Completed",
        };
      case "failed":
        return {
          icon: "x",
          color: "text-destructive",
          bg: "bg-destructive/10",
          label: "Failed",
        };
      default:
        return {
          icon: "help",
          color: "text-muted-foreground/50",
          bg: "bg-muted/20",
          label: "Unknown",
        };
    }
  };

  const config = statusConfig();

  return (
    <div
      class={cn(
        "mb-2 flex items-start gap-2",
        "rounded-lg p-2",
        config.bg,
        "border-border/30 border",
        props.class
      )}
    >
      {/* Status icon */}
      <div class={cn("mt-0.5", config.color)}>
        {config.icon === "spinner" ? (
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : config.icon === "check" ? (
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        ) : config.icon === "x" ? (
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : config.icon === "clock" ? (
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : null}
      </div>

      {/* Tool info */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-foreground/80 text-sm font-medium">{props.toolCall.name}</span>
          <span class="text-muted-foreground/60 text-xs">{config.label}</span>
        </div>

        {/* Arguments preview (truncated) */}
        <Show when={isExpanded()}>
          <div class="text-muted-foreground/70 mt-1 rounded bg-black/5 px-2 py-1 font-mono text-xs dark:bg-white/5">
            {JSON.stringify(props.toolCall.arguments, null, 2)}
          </div>
        </Show>

        {/* Result preview */}
        <Show when={props.toolCall.result && isExpanded()}>
          <div class="mt-1 rounded bg-green-500/10 px-2 py-1 font-mono text-xs text-green-600 dark:text-green-400">
            {typeof props.toolCall.result === "string"
              ? props.toolCall.result.slice(0, 100) +
                (props.toolCall.result.length > 100 ? "..." : "")
              : JSON.stringify(props.toolCall.result, null, 2)}
          </div>
        </Show>
      </div>
    </div>
  );
};
