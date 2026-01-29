/**
 * Chat API - AI chat endpoint with session management
 *
 * Handles chat requests with session bridge integration and UIMessage streaming.
 */

import { createLogger } from "@ekacode/shared/logger";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";
import type { Env } from "../index";
import { createSessionMessage, sessionBridge } from "../middleware/session-bridge";

const app = new Hono<Env>();
const logger = createLogger("server");

// Apply session bridge middleware
app.use("*", sessionBridge);

/**
 * Chat endpoint
 *
 * Accepts chat messages and streams AI responses using UIMessage format.
 *
 * Usage:
 * POST /api/chat
 * Headers:
 *   - X-Session-ID: <session-id> (optional, will be created if missing)
 * Query:
 *   - directory: <absolute path> (preferred workspace selector)
 *   - Content-Type: application/json
 * Body:
 *   {
 *     "message": "Hello, AI!",
 *     "stream": true
 *   }
 */
app.post("/api/chat", async c => {
  const requestId = c.get("requestId");
  const session = c.get("session");
  const sessionIsNew = c.get("sessionIsNew") ?? false;

  if (!session) {
    return c.json({ error: "Session not available" }, 500);
  }

  const body = await c.req.json();
  const message = body.message || "";
  const shouldStream = body.stream !== false;

  logger.info("Chat request received", {
    module: "chat",
    requestId,
    sessionId: session.sessionId,
    messageLength: message.length,
  });

  // For now, echo back the message with session info
  // In production, this would invoke the AI agent
  if (shouldStream) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        if (sessionIsNew) {
          writer.write(createSessionMessage(session));
        }

        const messageId = uuidv7();
        writer.write({
          type: "text-delta",
          id: messageId,
          delta: `Echo: You said "${message}"`,
        });

        writer.write({ type: "finish", finishReason: "stop" });
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "x-vercel-ai-ui-message-stream": "v1",
        "Content-Encoding": "none",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } else {
    return c.json({
      sessionId: session.sessionId,
      response: `Echo: You said "${message}"`,
    });
  }
});

/**
 * Get session info endpoint
 *
 * Returns the current session information.
 *
 * Usage:
 * GET /api/chat/session
 */
app.get("/api/chat/session", c => {
  const session = c.get("session");

  if (!session) {
    return c.json({ error: "Session not available" }, 500);
  }

  return c.json({
    sessionId: session.sessionId,
    resourceId: session.resourceId,
    threadId: session.threadId,
    createdAt: session.createdAt.toISOString(),
    lastAccessed: session.lastAccessed.toISOString(),
  });
});

export default app;
