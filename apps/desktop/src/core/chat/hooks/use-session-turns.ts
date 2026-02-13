/**
 * useSessionTurns Hook
 *
 * Reactive hook that projects ChatTurn model from normalized stores.
 * Provides OpenCode-like turn-based conversation view.
 */

import { createLogger } from "@/core/shared/logger";
import {
  useMessageStore,
  usePartStore,
  useSessionStore,
} from "@/core/state/providers/store-provider";
import { createMemo, onCleanup, type Accessor } from "solid-js";
import { buildChatTurns, type ChatTurn, type TurnProjectionOptions } from "./turn-projection";

const logger = createLogger("desktop:hooks:use-session-turns");

export function useSessionTurns(sessionId: Accessor<string | null>): Accessor<ChatTurn[]> {
  const [, messageActions] = useMessageStore();
  const [, partActions] = usePartStore();
  const [, sessionActions] = useSessionStore();

  const turns = createMemo<ChatTurn[]>(() => {
    const sid = sessionId();
    if (!sid) {
      logger.debug("No session ID, returning empty turns");
      return [];
    }

    const messages = messageActions.getBySession(sid);
    if (messages.length === 0) {
      logger.debug("No messages for session", { sessionId: sid });
      return [];
    }

    const partsByMessage: Record<string, ReturnType<typeof partActions.getByMessage>> = {};
    for (const msg of messages) {
      partsByMessage[msg.id] = partActions.getByMessage(msg.id);
    }

    const status = sessionActions.getStatus(sid);
    const statusType = status?.type;

    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    const lastUserMessageId = lastUserMessage?.id;

    const options: TurnProjectionOptions = {
      sessionId: sid,
      messages,
      partsByMessage,
      sessionStatus: statusType === "busy" ? "busy" : "idle",
      lastUserMessageId,
    };

    const result = buildChatTurns(options);
    logger.debug("Built turns", { sessionId: sid, count: result.length });

    return result;
  });

  onCleanup(() => {
    logger.debug("useSessionTurns cleanup");
  });

  return turns;
}

export type { ChatTurn } from "./turn-projection";
