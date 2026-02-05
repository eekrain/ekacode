/**
 * Unified Stream Protocol
 *
 * Server-side implementation of the unified event schema for chat streaming.
 * Emits stable part IDs (UUIDv7) for all parts, enabling client-side normalization.
 *
 * Event Types:
 * - part.created: New part created
 * - part.updated: Part updated (with optional delta)
 * - part.removed: Part removed
 * - message.created: New message created
 * - message.updated: Message metadata updated
 * - message.removed: Message removed
 * - stream.finished: Stream completed
 *
 * All events include:
 * - id: Unique event ID (UUIDv7)
 * - timestamp: Event timestamp
 * - data: Event-specific data
 */

import { v7 as uuidv7 } from "uuid";
import type { AgentEvent } from "../agent/workflow/types";

/**
 * Part types
 */
export type ServerPartType =
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
 * Base server event
 */
export interface ServerEvent {
  id: string;
  type: string;
  timestamp: number;
}

/**
 * Part created event
 */
export interface PartCreatedEvent extends ServerEvent {
  type: "part.created";
  data: {
    partId: string;
    messageId: string;
    sessionId: string;
    type: ServerPartType;
    content: unknown;
    order: number;
  };
}

/**
 * Part updated event
 */
export interface PartUpdatedEvent extends ServerEvent {
  type: "part.updated";
  data: {
    partId: string;
    messageId: string;
    content: unknown;
    delta?: string;
  };
}

/**
 * Part removed event
 */
export interface PartRemovedEvent extends ServerEvent {
  type: "part.removed";
  data: {
    partId: string;
    messageId: string;
  };
}

/**
 * Message created event
 */
export interface MessageCreatedEvent extends ServerEvent {
  type: "message.created";
  data: {
    messageId: string;
    sessionId: string;
    role: "user" | "assistant" | "system";
    createdAt: number;
  };
}

/**
 * Message updated event
 */
export interface MessageUpdatedEvent extends ServerEvent {
  type: "message.updated";
  data: {
    messageId: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Message removed event
 */
export interface MessageRemovedEvent extends ServerEvent {
  type: "message.removed";
  data: {
    messageId: string;
  };
}

/**
 * Stream finished event
 */
export interface StreamFinishedEvent extends ServerEvent {
  type: "stream.finished";
  data: {
    sessionId: string;
    messageId: string;
    finishReason: "stop" | "error" | "cancelled";
  };
}

/**
 * Union of all server events
 */
export type ServerStreamEvent =
  | PartCreatedEvent
  | PartUpdatedEvent
  | PartRemovedEvent
  | MessageCreatedEvent
  | MessageUpdatedEvent
  | MessageRemovedEvent
  | StreamFinishedEvent;

/**
 * Stream writer interface
 */
export interface StreamWriter {
  write(event: ServerStreamEvent): void;
}

/**
 * Stream context for tracking state
 */
export interface StreamContext {
  sessionId: string;
  messageId: string;
  partCounter: number;
  activeParts: Map<string, string>; // type -> partId mapping
}

/**
 * Create a new stream context
 */
export function createStreamContext(sessionId: string): StreamContext {
  return {
    sessionId,
    messageId: uuidv7(),
    partCounter: 0,
    activeParts: new Map(),
  };
}

/**
 * Get next part order index
 */
export function nextPartOrder(ctx: StreamContext): number {
  return ctx.partCounter++;
}

/**
 * Create a part created event
 */
export function createPartCreated(
  ctx: StreamContext,
  type: ServerPartType,
  content: unknown,
  existingPartId?: string
): PartCreatedEvent {
  const partId = existingPartId || uuidv7();
  ctx.activeParts.set(type, partId);

  return {
    id: uuidv7(),
    type: "part.created",
    timestamp: Date.now(),
    data: {
      partId,
      messageId: ctx.messageId,
      sessionId: ctx.sessionId,
      type,
      content,
      order: nextPartOrder(ctx),
    },
  };
}

/**
 * Create a part updated event
 */
export function createPartUpdated(
  ctx: StreamContext,
  partId: string,
  content: unknown,
  delta?: string
): PartUpdatedEvent {
  return {
    id: uuidv7(),
    type: "part.updated",
    timestamp: Date.now(),
    data: {
      partId,
      messageId: ctx.messageId,
      content,
      delta,
    },
  };
}

/**
 * Create a text delta event (updates existing text part or creates new)
 */
export function createTextDelta(
  ctx: StreamContext,
  text: string,
  isFirst: boolean
): PartCreatedEvent | PartUpdatedEvent {
  const existingPartId = ctx.activeParts.get("text");

  if (existingPartId && !isFirst) {
    // Update existing text part
    return createPartUpdated(ctx, existingPartId, { text, status: "streaming" }, text);
  } else {
    // Create new text part
    return createPartCreated(ctx, "text", { text, status: "streaming" });
  }
}

/**
 * Create a tool call event
 */
export function createToolCall(
  ctx: StreamContext,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>
): PartCreatedEvent {
  return createPartCreated(ctx, "tool-call", {
    toolCallId,
    toolName,
    args,
    status: "pending",
  });
}

/**
 * Create a tool result event (updates existing tool-call part)
 */
export function createToolResult(
  ctx: StreamContext,
  toolCallId: string,
  result: unknown,
  error?: string
): PartUpdatedEvent {
  return createPartUpdated(ctx, toolCallId, {
    toolCallId,
    result,
    error,
    status: error ? "error" : "completed",
  });
}

/**
 * Create a reasoning start event
 */
export function createReasoningStart(
  ctx: StreamContext,
  reasoningId: string,
  agentId?: string
): PartCreatedEvent {
  return createPartCreated(ctx, "reasoning", {
    reasoningId,
    text: "",
    status: "thinking",
    agentId,
  });
}

/**
 * Create a reasoning delta event
 */
export function createReasoningDelta(
  ctx: StreamContext,
  reasoningPartId: string,
  delta: string
): PartUpdatedEvent {
  return createPartUpdated(
    ctx,
    reasoningPartId,
    {
      text: delta, // Client accumulates
      status: "thinking",
    },
    delta
  );
}

/**
 * Create a reasoning end event
 */
export function createReasoningEnd(
  ctx: StreamContext,
  reasoningPartId: string,
  durationMs: number
): PartUpdatedEvent {
  return createPartUpdated(ctx, reasoningPartId, {
    status: "complete",
    durationMs,
  });
}

/**
 * Create a state update event
 */
export function createStateUpdate(
  ctx: StreamContext,
  state: "idle" | "running" | "completed" | "failed",
  iteration?: number,
  toolExecutionCount?: number
): PartCreatedEvent | PartUpdatedEvent {
  const existingPartId = ctx.activeParts.get("state");

  if (existingPartId) {
    return createPartUpdated(ctx, existingPartId, {
      state,
      iteration,
      toolExecutionCount,
    });
  }

  return createPartCreated(ctx, "state", {
    state,
    iteration,
    toolExecutionCount,
  });
}

/**
 * Create an error event
 */
export function createError(
  ctx: StreamContext,
  message: string,
  details?: string
): PartCreatedEvent {
  return createPartCreated(ctx, "error", {
    message,
    details,
  });
}

/**
 * Create a stream finished event
 */
export function createStreamFinished(
  ctx: StreamContext,
  finishReason: "stop" | "error" | "cancelled"
): StreamFinishedEvent {
  return {
    id: uuidv7(),
    type: "stream.finished",
    timestamp: Date.now(),
    data: {
      sessionId: ctx.sessionId,
      messageId: ctx.messageId,
      finishReason,
    },
  };
}

/**
 * Create an action event (build mode)
 */
export function createAction(ctx: StreamContext, action: AgentEvent): PartCreatedEvent {
  return createPartCreated(ctx, "action", action);
}

/**
 * Create a run card event (planning mode)
 */
export function createRunCard(
  ctx: StreamContext,
  runId: string,
  data: {
    title: string;
    subtitle?: string;
    status: "planning" | "executing" | "done" | "error";
    filesEditedOrder: string[];
    groupsOrder: string[];
  }
): PartCreatedEvent | PartUpdatedEvent {
  const existingPartId = ctx.activeParts.get(`run:${runId}`);

  if (existingPartId) {
    return createPartUpdated(ctx, existingPartId, {
      ...data,
      runId,
    });
  }

  return createPartCreated(ctx, "run", {
    ...data,
    runId,
  });
}

/**
 * Serialize event for transport
 */
export function serializeEvent(event: ServerStreamEvent): string {
  return JSON.stringify(event);
}

/**
 * Parse event from transport
 */
export function parseEvent(data: string): ServerStreamEvent | null {
  try {
    return JSON.parse(data) as ServerStreamEvent;
  } catch {
    return null;
  }
}
