/**
 * Turn Projection
 *
 * Pure projection functions that build ChatTurn model from normalized stores.
 * This is the core logic for OpenCode-like turn-based conversation layout.
 */

import type { MessageWithId } from "@/core/state/stores/message-store";
import type { Part } from "@ekacode/shared/event-types";

export interface TurnProjectionOptions {
  sessionId: string;
  messages: MessageWithId[];
  partsByMessage: Record<string, Part[]>;
  sessionStatus: "idle" | "busy";
  lastUserMessageId: string | undefined;
}

export interface ChatTurn {
  userMessage: MessageWithId;
  userParts: Part[];
  assistantMessages: MessageWithId[];
  assistantPartsByMessageId: Record<string, Part[]>;
  finalTextPart: Part | undefined;
  reasoningParts: Part[];
  toolParts: Part[];
  isActiveTurn: boolean;
  working: boolean;
  error: string | undefined;
  durationMs: number;
  statusLabel: string | undefined;
}

function getTimeField(message: MessageWithId, field: "created" | "completed"): number | undefined {
  const time = message.time;
  if (time && typeof time === "object" && field in time) {
    const value = (time as Record<string, unknown>)[field];
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

function getErrorMessage(message: MessageWithId): string | undefined {
  const error = (message as Record<string, unknown>).error;
  if (error && typeof error === "object") {
    const data = (error as Record<string, unknown>).data;
    if (data && typeof data === "object") {
      const msg = (data as Record<string, unknown>).message;
      if (typeof msg === "string") return msg;
    }
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === "string") return msg;
  }
  if (typeof error === "string") return error;
  return undefined;
}

export function computeDuration(startMs: number | undefined, endMs: number | undefined): number {
  if (startMs === undefined) return 0;
  const end = endMs ?? Date.now();
  return Math.max(0, end - startMs);
}

export function deriveStatusFromPart(part: Part | undefined): string | undefined {
  if (!part) return undefined;

  if (part.type === "reasoning") {
    return "Thinking";
  }

  if (part.type === "tool") {
    const toolName = (part as Record<string, unknown>).tool as string | undefined;
    switch (toolName) {
      case "read":
      case "list":
      case "grep":
      case "glob":
        return "Gathering context";
      case "edit":
      case "write":
        return "Making edits";
      case "bash":
        return "Running commands";
      case "question":
      case "permission":
        return "Waiting for input";
      default:
        return "Working";
    }
  }

  if (part.type === "text") {
    return "Gathering thoughts";
  }

  return undefined;
}

function findLastPartByType(parts: Part[], type: string): Part | undefined {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]?.type === type) return parts[i];
  }
  return undefined;
}

function getToolParts(parts: Part[]): Part[] {
  return parts.filter(p => p.type === "tool");
}

function getReasoningParts(parts: Part[]): Part[] {
  return parts.filter(p => p.type === "reasoning");
}

export function buildChatTurns(options: TurnProjectionOptions): ChatTurn[] {
  const { messages, partsByMessage, sessionStatus, lastUserMessageId } = options;

  if (messages.length === 0) return [];

  const turns: ChatTurn[] = [];
  const userMessages = messages.filter(m => m.role === "user");

  for (const userMessage of userMessages) {
    const userParts = partsByMessage[userMessage.id] ?? [];
    const isActiveTurn = userMessage.id === lastUserMessageId;
    const working = isActiveTurn && sessionStatus === "busy";

    const assistantMessages: MessageWithId[] = [];
    const assistantPartsByMessageId: Record<string, Part[]> = {};
    const allAssistantParts: Part[] = [];

    const userIndex = messages.findIndex(m => m.id === userMessage.id);
    for (let i = userIndex + 1; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user") break;
      if (msg.role === "assistant" && msg.parentID === userMessage.id) {
        assistantMessages.push(msg);
        const parts = partsByMessage[msg.id] ?? [];
        assistantPartsByMessageId[msg.id] = parts;
        allAssistantParts.push(...parts);
      }
    }

    const finalTextPart = findLastPartByType(allAssistantParts, "text");
    const reasoningParts = getReasoningParts(allAssistantParts);
    const toolParts = getToolParts(allAssistantParts);

    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    const error = lastAssistantMessage ? getErrorMessage(lastAssistantMessage) : undefined;

    const userCreated = getTimeField(userMessage, "created");
    const assistantCompleted = lastAssistantMessage
      ? getTimeField(lastAssistantMessage, "completed")
      : undefined;
    const durationMs = computeDuration(userCreated, assistantCompleted);

    const lastMeaningfulPart = allAssistantParts[allAssistantParts.length - 1];
    const statusLabel = working ? deriveStatusFromPart(lastMeaningfulPart) : undefined;

    turns.push({
      userMessage,
      userParts,
      assistantMessages,
      assistantPartsByMessageId,
      finalTextPart,
      reasoningParts,
      toolParts,
      isActiveTurn,
      working,
      error,
      durationMs,
      statusLabel,
    });
  }

  turns.sort((a, b) => {
    const aCreated = getTimeField(a.userMessage, "created") ?? 0;
    const bCreated = getTimeField(b.userMessage, "created") ?? 0;
    return aCreated - bCreated;
  });

  return turns;
}
