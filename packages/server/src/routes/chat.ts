/**
 * Chat API - AI chat endpoint with session management
 *
 * Handles chat requests with session bridge integration and UIMessage streaming.
 * Integrates with new SessionManager and WorkflowEngine for agent orchestration.
 * Supports multimodal (image) inputs that trigger vision model routing.
 */

import { createLogger } from "@ekacode/shared/logger";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { Env } from "../index";
import { getSessionManager } from "../index";
import { createSessionMessage, sessionBridge } from "../middleware/session-bridge";

const app = new Hono<Env>();
const logger = createLogger("server");

// Apply session bridge middleware
app.use("*", sessionBridge);

/**
 * Schema for multimodal chat messages
 *
 * Supports:
 * - Simple text messages
 * - Messages with image URLs
 * - Messages with base64-encoded images
 *
 * @example
 * // Simple text message
 * { message: "Hello" }
 *
 * // Multimodal message with image
 * { message: [{ type: "text", text: "What is this?" }, { type: "image", url: "..." }] }
 */
const chatMessageSchema = z.object({
  message: z.union([
    z.string(), // Simple text message
    z.object({
      // Multimodal message with content parts
      content: z.array(
        z.object({
          type: z.enum(["text", "image", "image_url", "file"]),
          text: z.string().optional(),
          url: z.string().optional(),
          image: z.union([z.string(), z.object({ url: z.string() })]).optional(),
          mediaType: z.string().optional(),
        })
      ),
    }),
  ]),
  stream: z.boolean().optional().default(true),
});

// Export for validation use in middleware
export { chatMessageSchema };

/**
 * Chat endpoint
 *
 * Accepts chat messages and streams AI responses using UIMessage format.
 * Uses SessionManager and SessionController for workflow orchestration.
 * Supports multimodal (image) inputs that trigger vision model routing.
 *
 * Usage:
 * POST /api/chat
 * Headers:
 *   - X-Session-ID: <session-id> (optional, will be created if missing)
 * Query:
 *   - directory: <absolute path> (preferred workspace selector)
 *   - Content-Type: application/json
 * Body (simple text):
 *   {
 *     "message": "Create a function that adds two numbers",
 *     "stream": true
 *   }
 * Body (with image):
 *   {
 *     "message": {
 *       "content": [
 *         { "type": "text", "text": "What does this image show?" },
 *         { "type": "image", "image": { "url": "https://example.com/image.jpg" } }
 *       ]
 *     },
 *     "stream": true
 *   }
 * Body (base64 image):
 *   {
 *     "message": {
 *       "content": [
 *         { "type": "text", "text": "Analyze this screenshot" },
 *         { "type": "file", "mediaType": "image/png", "data": "base64..." }
 *       ]
 *     }
 *   }
 */
app.post("/api/chat", async c => {
  const requestId = c.get("requestId");
  const session = c.get("session");
  const sessionIsNew = c.get("sessionIsNew") ?? false;
  const instanceContext = c.get("instanceContext");

  if (!session) {
    return c.json({ error: "Session not available" }, 500);
  }

  const body = await c.req.json();
  const rawMessage = body.message;
  const shouldStream = body.stream !== false;

  // Parse message - support both simple string and multimodal formats
  let messageText = "";
  if (typeof rawMessage === "string") {
    messageText = rawMessage;
  } else if (rawMessage && typeof rawMessage === "object" && "content" in rawMessage) {
    // Multimodal message with content parts
    const content = (rawMessage as { content: unknown }).content;
    if (Array.isArray(content)) {
      // Extract text from multimodal message for logging
      messageText = content
        .filter((part: { type: string; [key: string]: unknown }) => part.type === "text")
        .map((part: { type: string; [key: string]: unknown }) => {
          const textPart = part as { text?: string };
          return String(textPart.text ?? "");
        })
        .join(" ");
    } else {
      messageText = String(content);
    }
  } else {
    messageText = String(rawMessage ?? "");
  }

  logger.info("Chat request received", {
    module: "chat",
    requestId,
    sessionId: session.sessionId,
    messageLength: messageText.length,
    hasMultimodal: typeof rawMessage === "object" && "content" in rawMessage,
  });

  // Get workspace directory from Instance context
  const directory = instanceContext?.directory;
  if (!directory) {
    return c.json({ error: "No workspace directory" }, 400);
  }

  logger.debug("Getting or creating session controller", {
    module: "chat",
    directory,
    sessionId: session.sessionId,
  });

  // Get SessionManager and retrieve or create SessionController
  const sessionManager = getSessionManager();
  let controller = await sessionManager.getSession(session.sessionId);

  if (!controller) {
    // Create new SessionController for this session
    await sessionManager.createSession({
      resourceId: session.resourceId,
      task: messageText || "[Multimodal message]",
      workspace: directory,
    });

    // Get the newly created controller
    controller = await sessionManager.getSession(session.sessionId);

    if (!controller) {
      return c.json({ error: "Failed to create session controller" }, 500);
    }

    logger.debug("Created new session controller", {
      module: "chat",
      sessionId: session.sessionId,
      controllerId: controller.sessionId,
    });
  }

  // Create UIMessage stream
  if (shouldStream) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Send session message if new session
        if (sessionIsNew) {
          writer.write(createSessionMessage(session));
        }

        const messageId = uuidv7();
        let lastPhase: string | null = null;
        let _isComplete = false;

        try {
          // Start the workflow
          logger.debug("Starting workflow", {
            module: "chat",
            sessionId: session.sessionId,
            task: messageText,
          });

          // Start the workflow and monitor progress
          const workflowPromise = controller.start(messageText);

          // Monitor workflow progress
          const checkInterval = setInterval(() => {
            const status = controller.getStatus();

            // Send phase updates
            if (status.phase !== lastPhase) {
              writer.write({
                type: "data-state",
                id: "state",
                data: {
                  state: status.phase,
                  iteration: 0,
                  toolExecutionCount: 0,
                },
              });
              lastPhase = status.phase;
            }

            // Check for completion
            if (status.phase === "completed" || status.phase === "failed") {
              _isComplete = true;
              clearInterval(checkInterval);

              // Send final message
              writer.write({
                type: "text-delta",
                id: messageId,
                delta: status.summary || "",
              });

              writer.write({
                type: "finish",
                finishReason: status.phase === "completed" ? "stop" : "error",
              });
            }
          }, 100);

          // Wait for workflow completion (timeout: 10 minutes)
          const timeoutMs = 10 * 60 * 1000;

          await Promise.race([
            workflowPromise,
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("Agent execution timeout")), timeoutMs)
            ),
          ]);

          clearInterval(checkInterval);
        } catch (error) {
          _isComplete = true;
          if (error instanceof Error) {
            logger.error("Workflow execution error", error, {
              sessionId: session.sessionId,
            });
          } else {
            logger.error("Workflow execution error", undefined, {
              sessionId: session.sessionId,
              error: String(error),
            });
          }

          writer.write({
            type: "error",
            errorText: error instanceof Error ? error.message : String(error),
          });
        }
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-vercel-ai-ui-message-stream": "v1",
        "Content-Encoding": "none",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } else {
    // Non-streaming mode (for simple requests)
    return c.json({
      sessionId: session.sessionId,
      message: "Streaming is required for agent responses",
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

/**
 * Get session status endpoint
 *
 * Returns the current status of a session including phase and progress.
 * Used by UI to show hints about incomplete work.
 *
 * Usage:
 * GET /api/session/:sessionId/status
 */
app.get("/api/session/:sessionId/status", async c => {
  const sessionId = c.req.param("sessionId");
  const sessionManager = getSessionManager();

  const controller = await sessionManager.getSession(sessionId);

  if (!controller) {
    return c.json({ error: "Session not found" }, 404);
  }

  const status = controller.getStatus();

  return c.json({
    sessionId: status.sessionId,
    phase: status.phase,
    progress: status.progress,
    hasIncompleteWork: controller.hasIncompleteWork(),
    summary: status.summary,
    lastActivity: status.lastActivity,
    activeAgents: status.activeAgents,
  });
});

export default app;
