/**
 * Session Processor - Convert AI SDK stream to part events
 *
 * Processes AI SDK streaming responses and emits bus events for each part.
 * This bridges the AI SDK stream format to our Opencode-style event system.
 *
 * Flow:
 * AI SDK stream → Processor → Bus.publish() → SSE → Client
 */

import { v7 as uuidv7 } from "uuid";
import type {
  Part,
  ReasoningPart,
  StepFinishPart,
  StepStartPart,
  TextPart,
  ToolPart,
} from "./message-v2";

/**
 * Processor context for tracking active parts
 */
interface ProcessorContext {
  sessionID: string;
  messageID: string;
  activeParts: Map<string, Part>; // part type or toolCallID → part
  textPart?: TextPart;
  reasoningParts: Map<string, ReasoningPart>; // reasoning ID → part
}

/**
 * Create a new processor context
 */
export function createProcessorContext(sessionID: string, messageID: string): ProcessorContext {
  return {
    sessionID,
    messageID,
    activeParts: new Map(),
    reasoningParts: new Map(),
  };
}

/**
 * Stream event types from AI SDK
 */
type StreamEvent =
  | { type: "start" }
  | { type: "text-delta"; textDelta: string }
  | { type: "text-end" }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; textDelta: string }
  | { type: "reasoning-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | {
      type: "tool-result";
      toolCallId: string;
      result: string | { error?: string; result?: string };
    }
  | { type: "step-start"; stepId: string }
  | { type: "step-finish"; stepId: string; reason: string; usage?: unknown }
  | { type: "error"; error: Error }
  | { type: "finish"; finishReason: string };

/**
 * Processor configuration
 */
export interface ProcessorConfig {
  /**
   * Callback for emitting part created events
   */
  onPartCreated?: (part: Part) => void | Promise<void>;

  /**
   * Callback for emitting part updated events
   * @param part - The updated part
   * @param delta - Optional delta for text parts
   */
  onPartUpdated?: (part: Part, delta?: string) => void | Promise<void>;

  /**
   * Callback for emitting part removed events
   */
  _onPartRemoved?: (partID: string) => void | Promise<void>;

  /**
   * Callback for emitting message updated events
   */
  _onMessageUpdated?: (
    messageID: string,
    metadata?: Record<string, unknown>
  ) => void | Promise<void>;

  /**
   * Callback for session status changes
   */
  _onSessionStatus?: (status: "idle" | "busy") => void | Promise<void>;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeUsage(usage: unknown): {
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
} {
  const data = usage && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  return {
    cost: safeNumber(data.cost ?? data.totalCost),
    tokens: {
      input: safeNumber(data.inputTokens ?? data.promptTokens ?? data.input),
      output: safeNumber(data.outputTokens ?? data.completionTokens ?? data.output),
      reasoning: safeNumber(data.reasoningTokens ?? data.reasoning),
      cache: {
        read: safeNumber(data.cacheReadInputTokens ?? data.cachedInputTokens ?? data.cacheRead),
        write: safeNumber(data.cacheWriteInputTokens ?? data.cacheWrite),
      },
    },
  };
}

/**
 * Process an AI SDK stream and emit part events
 *
 * @param stream - Async iterable of stream events
 * @param context - Processor context
 * @param config - Processor configuration with callbacks
 */
export async function processStream(
  stream: AsyncIterable<StreamEvent>,
  context: ProcessorContext,
  config: ProcessorConfig
): Promise<void> {
  const { onPartCreated, onPartUpdated, _onSessionStatus, _onMessageUpdated } = config;

  for await (const event of stream) {
    switch (event.type) {
      case "start": {
        await _onSessionStatus?.("busy");
        break;
      }

      case "text-delta": {
        if (!context.textPart) {
          // Create text part on first delta
          context.textPart = {
            id: uuidv7(),
            sessionID: context.sessionID,
            messageID: context.messageID,
            type: "text",
            text: event.textDelta,
            time: {
              start: Date.now(),
            },
          };
          context.activeParts.set("text", context.textPart);
          await onPartCreated?.(context.textPart);
        } else {
          // Update existing text part
          context.textPart.text += event.textDelta;
          await onPartUpdated?.(context.textPart, event.textDelta);
        }
        break;
      }

      case "text-end": {
        if (context.textPart) {
          // Trim and set end time
          context.textPart.text = context.textPart.text.trimEnd();
          if (context.textPart.time) {
            context.textPart.time.end = Date.now();
          }
          await onPartUpdated?.(context.textPart);
        }
        break;
      }

      case "reasoning-start": {
        if (!context.reasoningParts.has(event.id)) {
          const part: ReasoningPart = {
            id: uuidv7(),
            sessionID: context.sessionID,
            messageID: context.messageID,
            type: "reasoning",
            text: "",
            time: {
              start: Date.now(),
            },
          };
          context.reasoningParts.set(event.id, part);
          context.activeParts.set(`reasoning:${event.id}`, part);
          await onPartCreated?.(part);
        }
        break;
      }

      case "reasoning-delta": {
        const part = context.reasoningParts.get(event.id);
        if (part) {
          part.text += event.textDelta;
          await onPartUpdated?.(part, event.textDelta);
        }
        break;
      }

      case "reasoning-end": {
        const part = context.reasoningParts.get(event.id);
        if (part) {
          part.text = part.text.trimEnd();
          part.time.end = Date.now();
          await onPartUpdated?.(part);
          context.reasoningParts.delete(event.id);
        }
        break;
      }

      case "tool-call": {
        // Create or update tool part
        const existingTool = context.activeParts.get(event.toolCallId) as ToolPart | undefined;

        const part: ToolPart = existingTool ?? {
          id: uuidv7(),
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "tool",
          callID: event.toolCallId,
          tool: event.toolName,
          state: {
            status: "pending",
            input: event.args,
            raw: JSON.stringify(event.args),
          },
        };

        // Update to running state
        part.state = {
          status: "running",
          input: event.args,
          time: {
            start: Date.now(),
          },
        };

        context.activeParts.set(event.toolCallId, part);
        if (existingTool) {
          await onPartUpdated?.(part);
        } else {
          await onPartCreated?.(part);
        }
        break;
      }

      case "tool-result": {
        const part = context.activeParts.get(event.toolCallId) as ToolPart | undefined;
        if (!part) break;
        const startedAt = part.state.status === "running" ? part.state.time.start : Date.now();

        const result = event.result;
        if (result && typeof result === "object" && "error" in result) {
          // Error state
          part.state = {
            status: "error",
            input: part.state.input,
            error: result.error || "Unknown error",
            time: {
              start: startedAt,
              end: Date.now(),
            },
          };
        } else {
          // Completed state
          part.state = {
            status: "completed",
            input: part.state.input,
            output:
              typeof result === "string"
                ? result
                : (JSON.stringify(result) ?? String(result ?? "null")),
            title: part.tool,
            metadata: {},
            time: {
              start: startedAt,
              end: Date.now(),
            },
          };
        }

        await onPartUpdated?.(part);
        break;
      }

      case "step-start": {
        const part: StepStartPart = {
          id: uuidv7(),
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "step-start",
        };
        context.activeParts.set(`step:${event.stepId}`, part);
        await onPartCreated?.(part);
        break;
      }

      case "step-finish": {
        const usage = normalizeUsage(event.usage);
        const part: StepFinishPart = {
          id: uuidv7(),
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "step-finish",
          reason: event.reason,
          tokens: usage.tokens,
          cost: usage.cost,
          snapshot: undefined,
        };
        await onPartCreated?.(part);
        break;
      }

      case "error": {
        await _onSessionStatus?.("idle");
        await _onMessageUpdated?.(context.messageID, {
          error: event.error.message,
        });
        const errorPart: Part = {
          id: uuidv7(),
          sessionID: context.sessionID,
          messageID: context.messageID,
          type: "error",
          message: event.error.message,
          details: event.error.stack,
        };
        await onPartCreated?.(errorPart);
        break;
      }

      case "finish": {
        await _onSessionStatus?.("idle");
        await _onMessageUpdated?.(context.messageID, {
          finishReason: event.finishReason,
        });
        break;
      }
    }
  }
}

/**
 * Create a processor that integrates with the Bus
 *
 * This is a convenience function that creates a processor
 * configured to emit events to the Bus.
 *
 * @param Bus - The event bus module
 * @returns Processor function
 */
export function createBusProcessor(Bus: {
  publish: (def: { type: string }, properties: unknown) => Promise<void>;
  MessagePartUpdated: { type: string };
}) {
  return (stream: AsyncIterable<StreamEvent>, context: ProcessorContext): Promise<void> => {
    return processStream(stream, context, {
      async onPartCreated(part) {
        // Publish part created event via bus
        await Bus.publish(Bus.MessagePartUpdated, {
          part,
        });
      },
      async onPartUpdated(part, delta) {
        // Publish part updated event via bus
        await Bus.publish(Bus.MessagePartUpdated, {
          part,
          delta,
        });
      },
    });
  };
}
