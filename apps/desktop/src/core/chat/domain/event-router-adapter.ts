/**
 * Event Router Adapter
 *
 * Bridges new domain stores with legacy SSE event handling.
 * Transforms DirectoryStore events into domain store operations.
 *
 * Phase 2: SSE & Data Flow Integration
 * Updated for Batch 2: Data Integrity - includes event ordering and deduplication
 */

import { createLogger } from "@/core/shared/logger";
import type { MessageActions } from "@/state/stores/message-store";
import type { PartActions } from "@/state/stores/part-store";
import type { PermissionActions } from "@/state/stores/permission-store";
import type { QuestionActions } from "@/state/stores/question-store";
import type {
  SessionInfo as DomainSessionInfo,
  SessionActions,
} from "@/state/stores/session-store";
import { EventDeduplicator } from "@ekacode/shared/event-deduplication";
import { validateEventComprehensive } from "@ekacode/shared/event-guards";
import { EventOrderingBuffer } from "@ekacode/shared/event-ordering";
import type { Part, ServerEvent } from "@ekacode/shared/event-types";

const logger = createLogger("event-router-adapter");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeMessageRole(role: unknown): "user" | "assistant" | "system" {
  if (role === "user" || role === "assistant" || role === "system") return role;
  return "assistant";
}

function parseSession(input: unknown): DomainSessionInfo | undefined {
  if (!isRecord(input)) return undefined;

  const sessionId =
    typeof input.sessionId === "string"
      ? input.sessionId
      : typeof input.id === "string"
        ? input.id
        : undefined;
  if (!sessionId) return undefined;

  return {
    sessionID: sessionId,
    directory:
      typeof (input as { directory?: string }).directory === "string"
        ? (input as { directory: string }).directory
        : "default",
  };
}

function toSessionStatus(
  status: unknown
):
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; attempt: number; message: string; next: number }
  | undefined {
  if (!status) return undefined;

  if (status === "idle") return { type: "idle" };
  if (status === "running") return { type: "busy" };
  if (status === "error") return { type: "idle" };

  if (!isRecord(status) || typeof status.type !== "string") return undefined;

  if (status.type === "idle" || status.type === "busy") {
    return { type: status.type };
  }

  if (
    status.type === "retry" &&
    typeof status.attempt === "number" &&
    typeof status.message === "string" &&
    typeof status.next === "number"
  ) {
    return {
      type: "retry",
      attempt: status.attempt,
      message: status.message,
      next: status.next,
    };
  }

  return undefined;
}

function forwardAuxiliaryEvent(event: ServerEvent): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent("ekacode:sse-event", { detail: event }));
  window.dispatchEvent(new CustomEvent(`ekacode:${event.type}`, { detail: event.properties }));
}

function parseMessageInfo(input: unknown):
  | {
      id: string;
      role: "user" | "assistant" | "system";
      sessionID?: string;
      time?: { created: number; completed?: number };
      parentID?: string;
      model?: string;
      provider?: string;
    }
  | undefined {
  if (!isRecord(input)) return undefined;
  if (typeof input.id !== "string") return undefined;

  const time = isRecord(input.time)
    ? {
        created: typeof input.time.created === "number" ? input.time.created : Date.now(),
        completed: typeof input.time.completed === "number" ? input.time.completed : undefined,
      }
    : undefined;

  return {
    id: input.id,
    role: normalizeMessageRole(input.role),
    sessionID: typeof input.sessionID === "string" ? input.sessionID : undefined,
    time,
    parentID:
      typeof input.parentID === "string"
        ? input.parentID
        : typeof input.parentId === "string"
          ? input.parentId
          : undefined,
    model:
      typeof input.model === "string"
        ? input.model
        : typeof input.modelID === "string"
          ? input.modelID
          : undefined,
    provider:
      typeof input.provider === "string"
        ? input.provider
        : typeof input.providerID === "string"
          ? input.providerID
          : undefined,
  };
}

// ============================================================================
// Event Ordering and Deduplication (Batch 2: Data Integrity)
// ============================================================================

/**
 * Global event ordering buffer instance
 * Ensures events are processed in sequence order per session
 */
const orderingBuffer = new EventOrderingBuffer({
  timeoutMs: 30000,
  maxQueueSize: 1000,
});

/**
 * Global event deduplicator instance
 * Prevents duplicate event processing
 */
const deduplicator = new EventDeduplicator({
  maxSize: 1000,
});

/**
 * Buffer parts that arrive before their parent message exists.
 * These are replayed once the message is created.
 */
const pendingPartsByMessage = new Map<string, Part[]>();

/**
 * Process a single event after validation, ordering, and deduplication
 */
function processEvent(
  event: ServerEvent,
  messageActions: MessageActions,
  partActions: PartActions,
  sessionActions: SessionActions,
  permissionActions?: PermissionActions,
  questionActions?: QuestionActions
): void {
  switch (event.type) {
    case "session.created":
    case "session.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const parsed = parseSession(props.info);
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const session: DomainSessionInfo | undefined =
        parsed ??
        (sessionID
          ? {
              sessionID,
              directory: typeof props.directory === "string" ? props.directory : "default",
            }
          : undefined);
      if (session) {
        sessionActions.upsert(session);
      }

      if (sessionID) {
        const status = toSessionStatus(props.status);
        if (status) {
          sessionActions.setStatus(sessionID, status);
        }
      }
      break;
    }

    case "message.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const info = parseMessageInfo(props.info);
      if (!info) break;
      const sessionID =
        info.sessionID ??
        (typeof props.sessionID === "string" ? props.sessionID : undefined) ??
        (typeof event.sessionID === "string" ? event.sessionID : undefined) ??
        (() => {
          if (!info.parentID) return undefined;
          return (messageActions.getById(info.parentID) as { sessionID?: string } | undefined)
            ?.sessionID;
        })();
      if (!sessionID) break;

      if (!sessionActions.getById(sessionID)) {
        sessionActions.upsert({
          sessionID,
          directory:
            typeof props.directory === "string"
              ? props.directory
              : typeof event.directory === "string"
                ? event.directory
                : "default",
        });
      }

      // Convert MessageInfo to MessageWithId format expected by store
      const messageWithId = {
        id: info.id,
        role: info.role,
        sessionID,
        time: info.time,
        parentID: info.parentID,
        model: info.model,
        provider: info.provider,
      };

      messageActions.upsert(messageWithId);

      const pendingParts = pendingPartsByMessage.get(info.id);
      if (pendingParts && pendingParts.length > 0) {
        for (const pendingPart of pendingParts) {
          try {
            partActions.upsert(pendingPart);
          } catch (error) {
            logger.error("Failed to apply buffered part after message creation", error as Error, {
              messageID: info.id,
              partID: pendingPart.id,
            });
          }
        }
        pendingPartsByMessage.delete(info.id);
      }
      break;
    }

    case "message.part.updated": {
      const props = isRecord(event.properties) ? event.properties : {};
      const part = isRecord(props.part) ? (props.part as Part) : undefined;
      if (
        !part ||
        typeof part.id !== "string" ||
        typeof part.messageID !== "string" ||
        typeof part.sessionID !== "string"
      ) {
        break;
      }

      if (!messageActions.getById(part.messageID)) {
        const queue = pendingPartsByMessage.get(part.messageID) ?? [];
        const existingIndex = queue.findIndex(item => item.id === part.id);
        if (existingIndex >= 0) {
          queue[existingIndex] = part;
        } else {
          queue.push(part);
        }
        pendingPartsByMessage.set(part.messageID, queue);
        break;
      }

      partActions.upsert(part);
      break;
    }

    case "message.part.removed": {
      const props = isRecord(event.properties) ? event.properties : {};
      const messageID = typeof props.messageID === "string" ? props.messageID : undefined;
      const partID = typeof props.partID === "string" ? props.partID : undefined;
      if (!messageID || !partID) break;
      partActions.remove(partID, messageID);
      break;
    }

    case "permission.asked":
      if (permissionActions) {
        const props = isRecord(event.properties) ? event.properties : {};
        const requestId = typeof props.id === "string" ? props.id : undefined;
        const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
        const permission = typeof props.permission === "string" ? props.permission : "tool";
        const tool = isRecord(props.tool) ? props.tool : {};
        const metadata = isRecord(props.metadata) ? props.metadata : {};
        const patterns = Array.isArray(props.patterns)
          ? props.patterns.filter(pattern => typeof pattern === "string")
          : [];

        if (requestId && sessionID) {
          permissionActions.add({
            id: requestId,
            sessionID,
            messageID:
              typeof tool.messageID === "string" ? tool.messageID : `permission:${requestId}`,
            toolName: permission,
            args: metadata,
            description:
              patterns.length > 0 ? `Requires permission for: ${patterns.join(", ")}` : undefined,
            status: "pending",
            timestamp: typeof event.timestamp === "number" ? event.timestamp : Date.now(),
            callID: typeof tool.callID === "string" ? tool.callID : undefined,
          });
        }
      }
      forwardAuxiliaryEvent(event);
      break;

    case "permission.replied":
      if (permissionActions) {
        const props = isRecord(event.properties) ? event.properties : {};
        const requestID = typeof props.requestID === "string" ? props.requestID : undefined;
        const reply = typeof props.reply === "string" ? props.reply : undefined;
        if (requestID) {
          permissionActions.resolve(requestID, reply !== "reject");
        }
      }
      forwardAuxiliaryEvent(event);
      break;

    case "question.asked":
      if (questionActions) {
        const props = isRecord(event.properties) ? event.properties : {};
        const requestId = typeof props.id === "string" ? props.id : undefined;
        const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
        const tool = isRecord(props.tool) ? props.tool : {};
        const questions = Array.isArray(props.questions) ? props.questions : [];
        const primaryQuestion = questions[0];
        const questionText =
          typeof primaryQuestion === "string"
            ? primaryQuestion
            : isRecord(primaryQuestion) && typeof primaryQuestion.question === "string"
              ? primaryQuestion.question
              : "Question";
        const options =
          isRecord(primaryQuestion) && Array.isArray(primaryQuestion.options)
            ? primaryQuestion.options.filter(option => typeof option === "string")
            : undefined;

        if (requestId && sessionID) {
          questionActions.add({
            id: requestId,
            sessionID,
            messageID:
              typeof tool.messageID === "string" ? tool.messageID : `question:${requestId}`,
            question: questionText,
            options,
            status: "pending",
            timestamp: typeof event.timestamp === "number" ? event.timestamp : Date.now(),
            callID: typeof tool.callID === "string" ? tool.callID : undefined,
          });
        }
      }
      forwardAuxiliaryEvent(event);
      break;

    case "question.replied":
      if (questionActions) {
        const props = isRecord(event.properties) ? event.properties : {};
        const requestID = typeof props.requestID === "string" ? props.requestID : undefined;
        if (requestID) {
          questionActions.answer(requestID, props.reply);
        }
      }
      forwardAuxiliaryEvent(event);
      break;

    case "question.rejected":
      if (questionActions) {
        const props = isRecord(event.properties) ? event.properties : {};
        const requestID = typeof props.requestID === "string" ? props.requestID : undefined;
        if (requestID) {
          questionActions.answer(requestID, {
            rejected: true,
            reason: typeof props.reason === "string" ? props.reason : undefined,
          });
        }
      }
      forwardAuxiliaryEvent(event);
      break;

    case "session.status": {
      const props = isRecord(event.properties) ? event.properties : {};
      const sessionID = typeof props.sessionID === "string" ? props.sessionID : undefined;
      const status = toSessionStatus(props.status);
      if (sessionID && status) {
        if (!sessionActions.getById(sessionID)) {
          sessionActions.upsert({
            sessionID,
            directory:
              typeof props.directory === "string"
                ? props.directory
                : typeof event.directory === "string"
                  ? event.directory
                  : "default",
          });
        }
        sessionActions.setStatus(sessionID, status);
      }
      break;
    }
  }
}

/**
 * Apply SSE event to domain stores with ordering and deduplication
 *
 * @param event - Server event from SSE
 * @param messageActions - Message store actions
 * @param partActions - Part store actions
 * @param sessionActions - Session store actions
 * @returns Array of events that were processed (may be empty if queued)
 */
export async function applyEventToStores(
  event: ServerEvent,
  messageActions: MessageActions,
  partActions: PartActions,
  sessionActions: SessionActions,
  permissionActions?: PermissionActions,
  questionActions?: QuestionActions
): Promise<ServerEvent[]> {
  // Step 1: Comprehensive validation
  const validation = validateEventComprehensive(event);
  if (!validation.valid) {
    logger.warn("Event validation failed", {
      error: validation.error,
      eventType: event.type,
      eventId: event.eventId,
    });
    return [];
  }

  // Step 2: Deduplication check
  if (deduplicator.isDuplicate(event.eventId)) {
    logger.debug("Duplicate event detected, skipping", {
      eventId: event.eventId,
      eventType: event.type,
    });
    return [];
  }

  // Step 3: Ordering - add to buffer and get processable events
  const eventsToProcess = await orderingBuffer.addEvent(event);

  // Step 4: Process all events that are now ready
  for (const evt of eventsToProcess) {
    try {
      processEvent(
        evt,
        messageActions,
        partActions,
        sessionActions,
        permissionActions,
        questionActions
      );
      logger.debug("Event processed successfully", {
        eventId: evt.eventId,
        eventType: evt.type,
        sequence: evt.sequence,
        sessionID: evt.sessionID,
      });
    } catch (error) {
      logger.error("Failed to process event", error as Error, {
        eventId: evt.eventId,
        eventType: evt.type,
      });
    }
  }

  return eventsToProcess;
}

/**
 * Get current ordering buffer statistics
 * Useful for debugging and monitoring
 */
export function getOrderingStats(sessionId?: string): Record<string, unknown> {
  if (sessionId) {
    return orderingBuffer.getStats(sessionId);
  }

  // Return stats for all sessions
  const allStats: Record<string, unknown> = {};
  // Note: We'd need to expose session IDs from the buffer for this
  return allStats;
}

/**
 * Get deduplicator statistics
 */
export function getDeduplicatorStats(): ReturnType<typeof deduplicator.getStats> {
  return deduplicator.getStats();
}

/**
 * Clear all ordering and deduplication state
 * Useful for testing or session reset
 */
export function clearEventProcessingState(): void {
  orderingBuffer.clear();
  deduplicator.clear();
  pendingPartsByMessage.clear();
  logger.info("Event processing state cleared");
}

/**
 * Clear state for a specific session
 */
export function clearSessionState(sessionId: string): void {
  orderingBuffer.clearSession(sessionId);
  for (const [messageID, parts] of pendingPartsByMessage.entries()) {
    const remaining = parts.filter(part => part.sessionID !== sessionId);
    if (remaining.length === 0) {
      pendingPartsByMessage.delete(messageID);
      continue;
    }
    pendingPartsByMessage.set(messageID, remaining);
  }
  logger.info("Session state cleared", { sessionId });
}

// Re-export for consumers who need direct access
export { EventDeduplicator, EventOrderingBuffer };
