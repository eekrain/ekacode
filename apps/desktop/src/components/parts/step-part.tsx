/**
 * Step Part Components - Step start/finish display
 *
 * Displays workflow step boundaries with running indicators and completion stats.
 */

import type { StepFinishPart, StepStartPart } from "@ekacode/core/chat";
import { Show, type JSX } from "solid-js";
import type { MessagePartProps, PartComponent } from "../message-part";

/**
 * Format token count with K suffix
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

/**
 * Step start part display component
 */
export const StepStartPartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as StepStartPart;

  return (
    <div
      data-component="step-start-part"
      class="my-2 rounded-r-md border-l-4 border-blue-500 bg-blue-50 p-3 dark:bg-blue-900/20"
    >
      <div data-slot="step-start-header" class="flex items-center gap-2">
        <span data-slot="step-start-icon" class="animate-pulse">
          🔄
        </span>
        <span data-slot="step-start-title" class="font-medium text-blue-700 dark:text-blue-300">
          Step Started
        </span>
      </div>
      <Show when={part.snapshot}>
        <div
          data-slot="step-start-snapshot"
          class="mt-2 text-sm text-slate-600 dark:text-slate-400"
        >
          {part.snapshot}
        </div>
      </Show>
    </div>
  );
};

/**
 * Step finish part display component
 */
export const StepFinishPartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as StepFinishPart;

  // Calculate totals
  const cacheRead = () => part.tokens.cache.read;
  const cacheWrite = () => part.tokens.cache.write;

  return (
    <div
      data-component="step-finish-part"
      class="my-2 rounded-r-md border-l-4 border-green-500 bg-green-50 p-3 dark:bg-green-900/20"
    >
      <div data-slot="step-finish-header" class="mb-2 flex items-center gap-2">
        <span data-slot="step-finish-icon">✅</span>
        <span data-slot="step-finish-title" class="font-medium text-green-700 dark:text-green-300">
          Step Completed
        </span>
        <Show when={part.reason}>
          <span data-slot="step-finish-reason" class="text-sm text-slate-600 dark:text-slate-400">
            ({part.reason})
          </span>
        </Show>
      </div>

      <Show when={part.cost > 0}>
        <div data-slot="step-finish-cost" class="text-sm text-slate-700 dark:text-slate-300">
          Cost: ${part.cost.toFixed(4)}
        </div>
      </Show>

      <div data-slot="step-finish-stats" class="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div data-slot="stat-input" class="rounded bg-white p-2 dark:bg-slate-950">
          <span class="text-muted-foreground">Input:</span> {formatTokens(part.tokens.input)}
        </div>
        <div data-slot="stat-output" class="rounded bg-white p-2 dark:bg-slate-950">
          <span class="text-muted-foreground">Output:</span> {formatTokens(part.tokens.output)}
        </div>
        <Show when={part.tokens.reasoning > 0}>
          <div data-slot="stat-reasoning" class="rounded bg-white p-2 dark:bg-slate-950">
            <span class="text-muted-foreground">Reasoning:</span>{" "}
            {formatTokens(part.tokens.reasoning)}
          </div>
        </Show>
        <Show when={cacheRead() > 0 || cacheWrite() > 0}>
          <div data-slot="stat-cache" class="rounded bg-white p-2 dark:bg-slate-950">
            <span class="text-muted-foreground">Cache:</span> R:{formatTokens(cacheRead())} W:
            {formatTokens(cacheWrite())}
          </div>
        </Show>
      </div>

      <Show when={part.snapshot}>
        <div
          data-slot="step-finish-snapshot"
          class="mt-2 text-sm text-slate-600 dark:text-slate-400"
        >
          {part.snapshot}
        </div>
      </Show>
    </div>
  );
};
