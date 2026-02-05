/**
 * AssistantMessage Component (Mode Router)
 *
 * Routes assistant messages to the appropriate UI based on mode:
 * - planning: RunCard component (aggregated view)
 * - build: ActivityFeed component (chronological timeline)
 * - chat: Standard message bubble (default)
 */

import { Match, Switch, type Component } from "solid-js";
import type { AgentMode, ChatMessageMetadata, ChatUIMessage } from "../types/ui-message";
import { ActivityFeed } from "./activity-feed/index";
import { RunCard } from "./run-card/index";
import { MessageBubble } from "/@/views/workspace-view/chat-area/message-bubble";

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
 */
const ChatMessageView: Component<{ message: ChatUIMessage }> = props => {
  return <MessageBubble message={props.message} />;
};

export default AssistantMessage;
