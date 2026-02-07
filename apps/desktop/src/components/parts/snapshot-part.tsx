/**
 * Snapshot Part Component - Code/state snapshot display
 *
 * Displays a code or state snapshot with timestamp and line count.
 */

import type { SnapshotPart } from "@ekacode/core/chat";
import { Show, type JSX } from "solid-js";
import type { MessagePartProps, PartComponent } from "../message-part";

/**
 * Calculate line count from snapshot content
 */
function getLineCount(snapshot: string): number {
  return snapshot.split("\n").length;
}

/**
 * Snapshot part display component
 */
export const SnapshotPartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as SnapshotPart;
  const lineCount = () => getLineCount(part.snapshot);

  return (
    <div
      data-component="snapshot-part"
      class="my-2 rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50"
    >
      <div data-slot="snapshot-header" class="mb-2 flex items-center justify-between">
        <div data-slot="snapshot-info" class="flex items-center gap-2">
          <span data-slot="snapshot-icon">📸</span>
          <span data-slot="snapshot-title" class="font-medium">
            Snapshot
          </span>
          <Show when={part.snapshot}>
            <span data-slot="snapshot-stats" class="text-muted-foreground text-sm">
              {lineCount()} lines
            </span>
          </Show>
        </div>
      </div>

      <Show when={part.snapshot}>
        <div
          data-slot="snapshot-content"
          class="max-h-96 overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-xs dark:bg-slate-950"
        >
          {part.snapshot}
        </div>
      </Show>
    </div>
  );
};
