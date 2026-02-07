/**
 * Patch Part Component - File patch/diff display
 *
 * Displays file patch/diff with unified diff format and +/- indicators.
 * Includes copy button for easy copying of the patch.
 */

import type { PatchPart } from "@ekacode/core/chat";
import { createSignal, type JSX } from "solid-js";
import type { MessagePartProps, PartComponent } from "../message-part";

/**
 * Parse patch content into diff lines
 * Returns array of lines with type indicator
 */
function parsePatchLines(
  patch: string
): Array<{ line: string; type: "header" | "add" | "remove" | "context" }> {
  return patch.split("\n").map(line => {
    if (
      line.startsWith("+++ ") ||
      line.startsWith("--- ") ||
      line.startsWith("diff ") ||
      line.startsWith("index ")
    ) {
      return { line, type: "header" };
    }
    if (line.startsWith("+")) {
      return { line, type: "add" };
    }
    if (line.startsWith("-")) {
      return { line, type: "remove" };
    }
    return { line, type: "context" };
  });
}

/**
 * Copy patch to clipboard
 */
async function copyPatch(patch: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(patch);
  } catch (error) {
    console.error("Failed to copy patch:", error);
  }
}

/**
 * Patch part display component
 */
export const PatchPartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as PatchPart;
  const [copied, setCopied] = createSignal(false);

  const lines = () => parsePatchLines(part.files.join("\n"));

  const handleCopy = async () => {
    await copyPatch(part.files.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-component="patch-part"
      class="my-2 rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50"
    >
      <div data-slot="patch-header" class="mb-2 flex items-center justify-between">
        <div data-slot="patch-info" class="flex items-center gap-2">
          <span data-slot="patch-icon">🔧</span>
          <span data-slot="patch-title" class="font-medium">
            Patch
          </span>
          <span data-slot="patch-hash" class="text-muted-foreground font-mono text-sm">
            {part.hash.slice(0, 8)}
          </span>
        </div>
        <button
          data-slot="patch-copy"
          onClick={handleCopy}
          class="rounded bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {copied() ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>

      <div
        data-slot="patch-content"
        class="max-h-96 overflow-x-auto overflow-y-auto whitespace-pre rounded bg-white p-2 font-mono text-xs dark:bg-slate-950"
      >
        {lines().map(({ line, type }) => (
          <div
            data-line-type={type}
            class={
              type === "header"
                ? "text-slate-500"
                : type === "add"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                  : type === "remove"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    : "text-slate-700 dark:text-slate-300"
            }
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
