/**
 * AssistantMessage Component (Mode Router)
 *
 * Routes assistant messages to the appropriate UI based on mode:
 * - planning: RunCard component (aggregated view)
 * - build: ActivityFeed component (chronological timeline)
 * - chat: Standard message bubble (default)
 */

import { For, Match, Switch, type Component, type JSX } from "solid-js";
import type { AgentMode, ChatMessageMetadata, ChatUIMessage } from "../types/ui-message";
import { ActivityFeed } from "./activity-feed/index";
import { Part } from "./message-part";
import { RunCard } from "./run-card/index";

export interface AssistantMessageProps {
  message: ChatUIMessage;
}

/**
 * Get the mode from message metadata, defaulting to "chat"
 * Prioritizes explicit metadata over heuristics to allow server-driven mode routing
 */
function getMode(message: ChatUIMessage): AgentMode {
  const metadata = message.metadata as ChatMessageMetadata | undefined;

  // Trust explicit metadata first - server is the source of truth
  if (metadata?.mode) {
    return metadata.mode;
  }

  // Fall back to heuristics only when no metadata is present
  const partTypes = message.parts.map(part => (part as { type?: string }).type || "");
  const hasToolParts =
    partTypes.includes("tool-call") ||
    partTypes.includes("tool-result") ||
    partTypes.includes("data-action") ||
    partTypes.includes("data-data-action");
  const hasRunParts =
    partTypes.includes("data-run") ||
    partTypes.includes("data-data-run") ||
    partTypes.includes("data-run-item") ||
    partTypes.includes("data-data-run-item");

  if (hasToolParts) return "build";
  if (hasRunParts) return "planning";
  return "chat";
}

/**
 * AssistantMessage - Routes to the appropriate UI based on mode
 */
export const AssistantMessage: Component<AssistantMessageProps> = props => {
  const mode = () => getMode(props.message);

  return (
    <Switch fallback={<ChatMessageView message={props.message} />}>
      <Match when={mode() === "planning"}>
        <RunCard message={props.message} />
      </Match>
      <Match when={mode() === "build"}>
        <ActivityFeed message={props.message} />
      </Match>
    </Switch>
  );
};

/**
 * Default chat message view (standard bubbles)
 * Now always renders via part registry - no fallback to MessageBubble
 */
const ChatMessageView: Component<{ message: ChatUIMessage }> = props => {
  // Convert ChatUIMessage to core Message format for part rendering
  const coreMessage = {
    info: {
      role: "assistant" as const,
      id: props.message.id,
    },
    parts: props.message.parts as unknown as import("@ekacode/core/chat").Part[],
    createdAt: Date.now(),
  } as import("@ekacode/core/chat").Message;

  return <AssistantMessageDisplay message={coreMessage} parts={coreMessage.parts} />;
};

export default AssistantMessage;

/**
 * Opencode-style assistant message display
 * Renders message with parts array using the part component registry
 */
export function AssistantMessageDisplay(props: {
  message: import("@ekacode/core/chat").Message;
  parts: import("@ekacode/core/chat").Part[];
}): JSX.Element {
  // Filter out internal tools
  const INTERNAL_TOOLS = ["todoread"];
  const filteredParts = () =>
    props.parts.filter(
      p =>
        p.type !== "tool" ||
        !INTERNAL_TOOLS.includes((p as import("@ekacode/core/chat").ToolPart).tool)
    );

  return (
    <div data-component="assistant-message" class="flex flex-col gap-2">
      <For each={filteredParts()}>
        {part => <Part part={part as import("@ekacode/core/chat").Part} message={props.message} />}
      </For>
    </div>
  );
}
