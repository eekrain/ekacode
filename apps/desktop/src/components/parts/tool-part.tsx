/**
 * Tool Part Component - State machine rendering
 *
 * Displays tool execution with state-based UI:
 * - pending: Tool waiting to execute
 * - running: Tool actively executing with spinner
 * - completed: Tool finished with results
 * - error: Tool failed with error message
 */

import type { ToolPart } from "@ekacode/core/chat";
import { Match, Show, Switch, createMemo, createSignal, type JSX } from "solid-js";
import type { MessagePartProps, PartComponent } from "../message-part";

/**
 * Get tool info for display (icon, title, subtitle)
 */
function getToolInfo(
  toolName: string,
  input?: Record<string, unknown>
): {
  icon: string;
  title: string;
  subtitle?: string;
} {
  switch (toolName) {
    case "fs/read":
    case "read_file":
      return {
        icon: "file-lines",
        title: "Read File",
        subtitle: input?.["path"] as string | undefined,
      };
    case "fs/write":
    case "write_file":
      return {
        icon: "pencil",
        title: "Write File",
        subtitle: input?.["path"] as string | undefined,
      };
    case "bash":
    case "shell":
      return {
        icon: "terminal",
        title: "Shell Command",
        subtitle: input?.["command"] as string | undefined,
      };
    case "search":
    case "grep":
      return {
        icon: "search",
        title: "Search",
        subtitle: input?.["pattern"] as string | undefined,
      };
    default:
      return {
        icon: "tool",
        title: toolName,
        subtitle: undefined,
      };
  }
}

/**
 * Tool part display component
 *
 * Renders tool execution based on state machine.
 * Handles permission prompts and inline question display.
 */
export const ToolPartDisplay: PartComponent = (props: MessagePartProps): JSX.Element => {
  const part = props.part as ToolPart;
  const toolInfo = createMemo(() =>
    getToolInfo(
      part.tool,
      part.state?.status === "pending"
        ? (part.state as { input: Record<string, unknown> }).input
        : undefined
    )
  );

  return (
    <div data-component="tool-part" data-tool-state={part.state.status}>
      <Switch fallback={<GenericTool part={part} />}>
        <Match when={part.state.status === "error"}>
          <ToolErrorState part={part} toolInfo={toolInfo()} />
        </Match>
        <Match when={part.state.status === "completed"}>
          <ToolCompletedState part={part} toolInfo={toolInfo()} />
        </Match>
        <Match when={part.state.status === "running"}>
          <ToolRunningState part={part} toolInfo={toolInfo()} />
        </Match>
        <Match when={part.state.status === "pending"}>
          <ToolPendingState part={part} toolInfo={toolInfo()} />
        </Match>
      </Switch>
    </div>
  );
};

/**
 * Pending state - tool waiting to execute
 */
function ToolPendingState(props: {
  part: ToolPart;
  toolInfo: ReturnType<typeof getToolInfo>;
}): JSX.Element {
  return (
    <div data-component="tool-pending" class="opacity-70">
      <div data-slot="tool-header">
        <span data-slot="tool-icon">⏳</span>
        <span data-slot="tool-title">{props.toolInfo.title}</span>
        <Show when={props.toolInfo.subtitle}>
          <span data-slot="tool-subtitle">{props.toolInfo.subtitle}</span>
        </Show>
      </div>
    </div>
  );
}

/**
 * Running state - tool actively executing
 */
function ToolRunningState(props: {
  part: ToolPart;
  toolInfo: ReturnType<typeof getToolInfo>;
}): JSX.Element {
  return (
    <div data-component="tool-running">
      <div data-slot="tool-header">
        <span data-slot="tool-icon" class="animate-spin">
          ⚙️
        </span>
        <span data-slot="tool-title">{props.toolInfo.title}</span>
        <Show when={props.toolInfo.subtitle}>
          <span data-slot="tool-subtitle">{props.toolInfo.subtitle}</span>
        </Show>
        <span data-slot="tool-status" class="text-blue-500">
          Running...
        </span>
      </div>
    </div>
  );
}

/**
 * Completed state - tool finished with results
 */
function ToolCompletedState(props: {
  part: ToolPart;
  toolInfo: ReturnType<typeof getToolInfo>;
}): JSX.Element {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <div data-component="tool-completed">
      <div
        data-slot="tool-header"
        class="hover:bg-muted/50 cursor-pointer"
        onClick={() => setExpanded(!expanded())}
      >
        <span data-slot="tool-icon">✅</span>
        <span data-slot="tool-title">{props.toolInfo.title}</span>
        <Show when={props.toolInfo.subtitle}>
          <span data-slot="tool-subtitle">{props.toolInfo.subtitle}</span>
        </Show>
        <span data-slot="tool-toggle" class="ml-auto">
          {expanded() ? "▼" : "▶"}
        </span>
      </div>
      <Show when={expanded()}>
        <div
          data-slot="tool-output"
          class="bg-muted mt-2 whitespace-pre-wrap rounded p-2 font-mono text-sm"
        >
          {(props.part.state as { output: string }).output}
        </div>
      </Show>
    </div>
  );
}

/**
 * Error state - tool failed
 */
function ToolErrorState(props: {
  part: ToolPart;
  toolInfo: ReturnType<typeof getToolInfo>;
}): JSX.Element {
  const error = (props.part.state as { error: string }).error;

  return (
    <div data-component="tool-error" class="border border-red-500 bg-red-50 dark:bg-red-900/20">
      <div data-slot="tool-header">
        <span data-slot="tool-icon">❌</span>
        <span data-slot="tool-title">{props.toolInfo.title}</span>
        <span data-slot="tool-status" class="text-red-500">
          Error
        </span>
      </div>
      <div data-slot="error-message" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    </div>
  );
}

/**
 * Generic tool fallback display
 */
function GenericTool(props: { part: ToolPart }): JSX.Element {
  const info = getToolInfo(props.part.tool);
  return (
    <div data-component="tool-generic">
      <div data-slot="tool-header">
        <span data-slot="tool-icon">{info.icon}</span>
        <span data-slot="tool-title">{info.title}</span>
        <Show when={info.subtitle}>
          <span data-slot="tool-subtitle">{info.subtitle}</span>
        </Show>
      </div>
    </div>
  );
}

// Export for use in other components
export { getToolInfo };
