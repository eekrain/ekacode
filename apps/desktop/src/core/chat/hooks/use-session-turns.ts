/**
 * useSessionTurns Hook
 *
 * Reactive hook that projects ChatTurn model from normalized stores.
 * Provides OpenCode-like turn-based conversation view.
 */

import { recordChatPerfCounter } from "@/core/chat/services/chat-perf-telemetry";
import {
  useMessageStore,
  usePartStore,
  usePermissionStore,
  useQuestionStore,
  useSessionStore,
} from "@/core/state/providers/store-provider";
import { createMemo, type Accessor } from "solid-js";
import { buildChatTurns, type ChatTurn, type TurnProjectionOptions } from "./turn-projection";

interface CachedTurnEntry {
  fingerprint: string;
  turn: ChatTurn;
}

function readNumericField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function partFingerprint(part: ChatTurn["orderedParts"][number]): string {
  const metadata = (part as { metadata?: Record<string, unknown> }).metadata;
  const seq = readNumericField(metadata?.__eventSequence) ?? -1;
  const partTime = (part as { time?: { start?: unknown; end?: unknown } }).time;
  const start = readNumericField(partTime?.start) ?? -1;
  const end = readNumericField(partTime?.end) ?? -1;
  const state = (part as { state?: Record<string, unknown> }).state;
  const stateTime = (state?.time as { start?: unknown; end?: unknown } | undefined) ?? {};
  const stateStart = readNumericField(stateTime.start) ?? -1;
  const stateEnd = readNumericField(stateTime.end) ?? -1;
  const partRecord = part as Record<string, unknown>;
  const text = typeof partRecord.text === "string" ? partRecord.text : "";
  const status = typeof (state?.status as unknown) === "string" ? (state?.status as string) : "";

  return [
    part.id ?? "",
    part.type ?? "",
    seq,
    start,
    end,
    stateStart,
    stateEnd,
    status,
    text.length,
  ].join("|");
}

function turnFingerprint(turn: ChatTurn): string {
  const retry = turn.retry;
  return [
    turn.userMessage.id,
    turn.isActiveTurn ? "1" : "0",
    turn.working ? "1" : "0",
    turn.statusLabel ?? "",
    turn.error ?? "",
    retry ? `${retry.attempt}:${retry.next}:${retry.message}` : "",
    turn.assistantMessages.map(message => message.id).join(","),
    turn.orderedParts.map(part => partFingerprint(part)).join(","),
  ].join("#");
}

export function useSessionTurns(sessionId: Accessor<string | null>): Accessor<ChatTurn[]> {
  const [, messageActions] = useMessageStore();
  const [, partActions] = usePartStore();
  const [, sessionActions] = useSessionStore();
  const [, permissionActions] = usePermissionStore();
  const [, questionActions] = useQuestionStore();
  const turnCache = new Map<string, CachedTurnEntry>();

  const turns = createMemo<ChatTurn[]>(() => {
    const sid = sessionId();
    if (!sid) {
      turnCache.clear();
      return [];
    }

    const messages = messageActions.getBySession(sid);
    if (messages.length === 0) {
      turnCache.clear();
      return [];
    }

    const partsByMessage: Record<string, ReturnType<typeof partActions.getByMessage>> = {};
    for (const msg of messages) {
      partsByMessage[msg.id] = partActions.getByMessage(msg.id);
    }

    const status = sessionActions.getStatus(sid);
    const permissionRequests = permissionActions.getBySession(sid);
    const questionRequests = questionActions.getBySession(sid);

    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    const lastUserMessageId = lastUserMessage?.id;

    const options: TurnProjectionOptions = {
      sessionId: sid,
      messages,
      partsByMessage,
      permissionRequests,
      questionRequests,
      sessionStatus: status,
      lastUserMessageId,
    };

    const projectionStart = performance.now();
    const projectedTurns = buildChatTurns(options);
    const projectionMs = performance.now() - projectionStart;
    recordChatPerfCounter("turnProjections");
    recordChatPerfCounter("turnProjectionMs", projectionMs);
    const nextCache = new Map<string, CachedTurnEntry>();

    const stabilizedTurns = projectedTurns.map(turn => {
      const key = turn.userMessage.id;
      const fingerprint = turnFingerprint(turn);
      const cached = turnCache.get(key);
      if (cached && cached.fingerprint === fingerprint) {
        nextCache.set(key, cached);
        return cached.turn;
      }

      const entry: CachedTurnEntry = { fingerprint, turn };
      nextCache.set(key, entry);
      return turn;
    });

    turnCache.clear();
    for (const [key, value] of nextCache.entries()) {
      turnCache.set(key, value);
    }

    return stabilizedTurns;
  });

  return turns;
}

export type { ChatTurn } from "./turn-projection";
