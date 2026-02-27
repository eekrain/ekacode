import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db, toolSessions } from "../../../../../db/index.js";
import { updateTaskSessionTitle } from "../../../../../db/task-sessions.js";
import type {
  IChatSessionRepository,
  RuntimeMode,
} from "../../domain/repositories/chat-session.repository.js";

const SPEC_TOOL_NAME = "spec";
const SESSION_MODE_KEY = "runtimeMode";

export class DrizzleChatSessionRepository implements IChatSessionRepository {
  async persistRuntimeMode(sessionId: string, mode: RuntimeMode): Promise<void> {
    const now = new Date();
    const existing = await db
      .select()
      .from(toolSessions)
      .where(
        and(
          eq(toolSessions.session_id, sessionId),
          eq(toolSessions.tool_name, SPEC_TOOL_NAME),
          eq(toolSessions.tool_key, SESSION_MODE_KEY)
        )
      )
      .get();

    if (existing) {
      await db
        .update(toolSessions)
        .set({
          data: { mode },
          last_accessed: now,
        })
        .where(eq(toolSessions.tool_session_id, existing.tool_session_id));
      return;
    }

    await db.insert(toolSessions).values({
      tool_session_id: uuidv7(),
      session_id: sessionId,
      tool_name: SPEC_TOOL_NAME,
      tool_key: SESSION_MODE_KEY,
      data: { mode },
      created_at: now,
      last_accessed: now,
    });
  }

  async updateAutoTitle(sessionId: string, title: string): Promise<boolean> {
    return updateTaskSessionTitle(sessionId, title, {
      source: "auto",
      onlyIfProvisional: true,
    });
  }
}

export const chatSessionRepository = new DrizzleChatSessionRepository();
