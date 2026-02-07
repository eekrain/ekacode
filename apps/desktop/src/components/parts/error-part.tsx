/**
 * Error Part Component - Error display
 *
 * Displays error information with optional stack traces.
 */

import type { ErrorPart as ErrorPartType } from "@ekacode/core/chat";
import { Show, type JSX } from "solid-js";
import type { MessagePartProps, PartComponent } from "../message-part";

/**
 * Error part display component
 */
export const ErrorPartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as ErrorPartType;

  return (
    <div
      data-component="error-part"
      class="my-2 rounded-md border border-red-500 bg-red-50 p-3 dark:bg-red-900/20"
    >
      <div data-slot="error-header" class="flex items-start gap-2">
        <span data-slot="error-icon" class="text-red-500">
          ❌
        </span>
        <div class="flex-1">
          <div data-slot="error-message" class="font-medium text-red-700 dark:text-red-300">
            {part.message}
          </div>
          <Show when={part.details}>
            <div
              data-slot="error-details"
              class="mt-2 whitespace-pre-wrap text-sm text-red-600 dark:text-red-400"
            >
              {part.details}
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
