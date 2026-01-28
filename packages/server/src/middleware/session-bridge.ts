/**
 * Session bridge middleware
 *
 * Handles session generation, validation, and context injection for Hono.
 * Generates UUIDv7 session IDs server-side and persists sessions to the database.
 */

import type { Context, Next } from "hono";
import type { Session } from "../../db/sessions";
import { createSession, getSession, touchSession } from "../../db/sessions";
import type { Env } from "../index";

/**
 * Session bridge middleware
 *
 * Checks for X-Session-ID header:
 * - If missing: generates UUIDv7, creates session, makes it available via context
 * - If present: validates session exists, touches lastAccessed, makes it available via context
 *
 * The session is available to request handlers via `c.get("session")`.
 */
export async function sessionBridge(c: Context<Env>, next: Next): Promise<Response | void> {
  const sessionId = c.req.header("X-Session-ID");

  if (!sessionId) {
    // No session ID provided - create new session
    const session = await createSession("local");

    // Make session available to handlers
    c.set("session", session);
    c.set("sessionIsNew", true);

    // Note: In production, you'd emit `data-session` in the UIMessage stream
    // This would be handled by the chat endpoint that streams responses

    await next();
  } else {
    // Session ID provided - validate and retrieve
    const session = await getSession(sessionId);

    if (!session) {
      // Invalid session ID
      return c.json({ error: "Invalid session" }, 401);
    }

    // Update lastAccessed timestamp
    await touchSession(sessionId);

    // Make session available to handlers
    c.set("session", session);
    c.set("sessionIsNew", false);

    await next();
  }
}

/**
 * Helper to emit data-session in UIMessage stream
 *
 * This would be used in the chat endpoint when streaming responses.
 *
 * @param session - The session to emit
 * @returns A UIMessage part containing the session data
 */
export function createSessionMessage(session: Session): {
  type: "data-session";
  id: "session";
  data: {
    sessionId: string;
    resourceId: string;
    threadId: string;
    createdAt: string;
    lastAccessed: string;
  };
} {
  return {
    type: "data-session",
    id: "session",
    data: {
      sessionId: session.sessionId,
      resourceId: session.resourceId,
      threadId: session.threadId,
      createdAt: session.createdAt.toISOString(),
      lastAccessed: session.lastAccessed.toISOString(),
    },
  };
}
