/**
 * Part Types for Normalized Chat Storage
 *
 * Defines all part types used in the normalized chat architecture.
 * Parts are stored separately from messages and linked by messageId.
 *
 * Based on OpenCode's message-v2.ts architecture.
 */

import type { AgentEventAction, AgentEventKind } from "./ui-message";

/**
 * Base part interface
 */
export interface BasePart {
  /** Unique part ID (UUIDv7) */
  id: string;
  /** Parent message ID */
  messageId: string;
  /** Session ID */
  sessionId: string;
  /** Part type discriminator */
  type: PartType;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt?: number;
  /** Sort order within message */
  order: number;
  /** Part content (type-specific) */
  content: unknown;
}

/**
 * Part type discriminator
 */
export type PartType =
  | "text"
  | "tool-call"
  | "tool-result"
  | "reasoning"
  | "run"
  | "run-group"
  | "run-item"
  | "action"
  | "state"
  | "error";

/**
 * Text content
 */
export interface TextContent {
  /** Text content */
  text: string;
  /** Streaming status */
  status: "streaming" | "complete";
}

/**
 * Text part for message content
 */
export interface TextPart extends BasePart {
  type: "text";
  content: TextContent;
}

/**
 * Tool call content
 */
export interface ToolCallContent {
  /** Tool call ID (from AI SDK) */
  toolCallId: string;
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Execution status */
  status: "pending" | "running" | "completed" | "error";
}

/**
 * Tool call part
 */
export interface ToolCallPart extends BasePart {
  type: "tool-call";
  content: ToolCallContent;
}

/**
 * Tool result content
 */
export interface ToolResultContent {
  /** Tool call ID (links to tool-call part) */
  toolCallId: string;
  /** Tool name */
  toolName: string;
  /** Execution result */
  result: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Tool result part
 */
export interface ToolResultPart extends BasePart {
  type: "tool-result";
  content: ToolResultContent;
}

/**
 * Reasoning content
 */
export interface ReasoningContent {
  /** Reasoning ID */
  reasoningId: string;
  /** Accumulated reasoning text */
  text: string;
  /** Status */
  status: "thinking" | "complete";
  /** Duration in ms (set when complete) */
  durationMs?: number;
  /** Agent ID */
  agentId?: string;
}

/**
 * Reasoning part for thinking display
 */
export interface ReasoningPart extends BasePart {
  type: "reasoning";
  content: ReasoningContent;
}

/**
 * Run card content (planning mode)
 */
export interface RunCardContent {
  /** Run ID */
  runId: string;
  /** Run title */
  title: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Current status */
  status: "planning" | "executing" | "done" | "error";
  /** Ordered list of edited file paths */
  filesEditedOrder: string[];
  /** Ordered list of progress group IDs */
  groupsOrder: string[];
  /** Whether all groups are collapsed */
  collapsedAll?: boolean;
  /** Start timestamp */
  startedAt?: number;
  /** First significant update timestamp */
  firstSignificantUpdateAt?: number;
  /** Finish timestamp */
  finishedAt?: number;
  /** Duration in ms */
  elapsedMs?: number;
}

/**
 * Run card part (planning mode)
 */
export interface RunCardPart extends BasePart {
  type: "run";
  content: RunCardContent;
}

/**
 * Run group content
 */
export interface RunGroupContent {
  /** Group ID */
  groupId: string;
  /** Run ID (parent) */
  runId: string;
  /** Group index */
  index: number;
  /** Group title */
  title: string;
  /** Whether collapsed */
  collapsed: boolean;
  /** Ordered list of item IDs */
  itemsOrder: string[];
}

/**
 * Run group part
 */
export interface RunGroupPart extends BasePart {
  type: "run-group";
  content: RunGroupContent;
}

/**
 * Run item content
 */
export interface RunItemContent {
  /** Item ID */
  itemId: string;
  /** Group ID (parent) */
  groupId: string;
  /** Event kind */
  kind: AgentEventKind;
  /** Display title */
  title: string;
  /** Secondary text */
  subtitle?: string;
  /** Timestamp */
  timestamp: number;
  /** File info */
  file?: {
    path: string;
    range?: string;
  };
  /** Diff stats */
  diff?: {
    plus: number;
    minus: number;
  };
  /** Terminal info */
  terminal?: {
    command: string;
    cwd?: string;
    outputPreview: string;
    exitCode?: number;
  };
  /** Error info */
  error?: {
    message: string;
    details?: string;
  };
  /** Available actions */
  actions?: AgentEventAction[];
}

/**
 * Run item part
 */
export interface RunItemPart extends BasePart {
  type: "run-item";
  content: RunItemContent;
}

/**
 * Action content (build mode)
 */
export interface ActionContent {
  /** Action ID */
  actionId: string;
  /** Event kind */
  kind: AgentEventKind;
  /** Display title */
  title: string;
  /** Secondary text */
  subtitle?: string;
  /** Timestamp */
  timestamp: number;
  /** Tool call ID (if from tool) */
  toolCallId?: string;
  /** Agent ID */
  agentId?: string;
  /** File info */
  file?: {
    path: string;
    range?: string;
  };
  /** Diff stats */
  diff?: {
    plus: number;
    minus: number;
  };
  /** Terminal info */
  terminal?: {
    command: string;
    cwd?: string;
    outputPreview: string;
    exitCode?: number;
  };
  /** Error info */
  error?: {
    message: string;
    details?: string;
  };
  /** Available actions */
  actions?: AgentEventAction[];
}

/**
 * Action part (build mode)
 */
export interface ActionPart extends BasePart {
  type: "action";
  content: ActionContent;
}

/**
 * State content
 */
export interface StateContent {
  /** Execution state */
  state: "idle" | "running" | "completed" | "failed";
  /** Iteration count */
  iteration?: number;
  /** Tool execution count */
  toolExecutionCount?: number;
}

/**
 * State part
 */
export interface StatePart extends BasePart {
  type: "state";
  content: StateContent;
}

/**
 * Error content
 */
export interface ErrorContent {
  /** Error message */
  message: string;
  /** Error details */
  details?: string;
}

/**
 * Error part
 */
export interface ErrorPart extends BasePart {
  type: "error";
  content: ErrorContent;
}

/**
 * Union of all part types
 */
export type Part =
  | TextPart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart
  | RunCardPart
  | RunGroupPart
  | RunItemPart
  | ActionPart
  | StatePart
  | ErrorPart;

/**
 * Helper type to extract part by type
 */
export type PartOfType<T extends PartType> = Extract<Part, { type: T }>;

/**
 * Create a new text part
 */
export function createTextPart(
  id: string,
  messageId: string,
  sessionId: string,
  text: string,
  order: number
): TextPart {
  return {
    id,
    messageId,
    sessionId,
    type: "text",
    content: {
      text,
      status: "streaming",
    },
    createdAt: Date.now(),
    order,
  };
}

/**
 * Create a new tool call part
 */
export function createToolCallPart(
  id: string,
  messageId: string,
  sessionId: string,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  order: number
): ToolCallPart {
  return {
    id,
    messageId,
    sessionId,
    type: "tool-call",
    content: {
      toolCallId,
      toolName,
      args,
      status: "pending",
    },
    createdAt: Date.now(),
    order,
  };
}

/**
 * Create a new tool result part
 */
export function createToolResultPart(
  id: string,
  messageId: string,
  sessionId: string,
  toolCallId: string,
  toolName: string,
  result: unknown,
  order: number,
  error?: string
): ToolResultPart {
  return {
    id,
    messageId,
    sessionId,
    type: "tool-result",
    content: {
      toolCallId,
      toolName,
      result,
      error,
    },
    createdAt: Date.now(),
    order,
  };
}

/**
 * Create a new reasoning part
 */
export function createReasoningPart(
  id: string,
  messageId: string,
  sessionId: string,
  reasoningId: string,
  order: number,
  agentId?: string
): ReasoningPart {
  return {
    id,
    messageId,
    sessionId,
    type: "reasoning",
    content: {
      reasoningId,
      text: "",
      status: "thinking",
      agentId,
    },
    createdAt: Date.now(),
    order,
  };
}
