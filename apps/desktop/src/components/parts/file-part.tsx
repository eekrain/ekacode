/**
 * File Part Component - File attachment display
 *
 * Displays file attachments and embedded images.
 */

import type { FilePart as FilePartType } from "@ekacode/core/chat";
import { Show, type JSX } from "solid-js";
import type { MessagePartProps, PartComponent } from "../message-part";

/**
 * File part display component
 */
export const FilePartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as FilePartType;
  const isImage = part.mime.startsWith("image/");

  return (
    <div data-component="file-part" class="my-2">
      <Show
        when={isImage}
        fallback={
          <div data-slot="file-attachment" class="flex items-center gap-2 rounded-md border p-2">
            <span data-slot="file-icon">📎</span>
            <span data-slot="file-name" class="text-sm">
              {part.filename || part.url.split("/").pop()}
            </span>
            <a
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              class="ml-auto text-xs text-blue-500 hover:underline"
            >
              Download
            </a>
          </div>
        }
      >
        <img
          data-slot="file-image"
          src={part.url}
          alt={part.filename || "Attachment"}
          class="h-auto max-w-full rounded-md border"
        />
      </Show>
    </div>
  );
};
