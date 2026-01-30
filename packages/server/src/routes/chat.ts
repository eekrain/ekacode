/**
 * Chat API - AI chat endpoint with session management
 *
 * Handles chat requests with session bridge integration and UIMessage streaming.
 * Integrates with XState RLM workflow for agent orchestration.
 * Supports multimodal (image) inputs that trigger vision model routing.
 */

import { createRLMActor, getTextContent } from "@ekacode/core";
import { createLogger } from "@ekacode/shared/logger";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { Env } from "../index";
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
 * Invokes the XState RLM workflow for full agent orchestration.
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
  let message: string | Array<{ type: string; [key: string]: unknown }>;
  let messageText = "";
  if (typeof rawMessage === "string") {
    message = rawMessage;
    messageText = rawMessage;
  } else if (rawMessage && typeof rawMessage === "object" && "content" in rawMessage) {
    // Multimodal message with content parts
    const content = (rawMessage as { content: unknown }).content;
    if (Array.isArray(content)) {
      message = content;
      // Extract text from multimodal message for logging
      messageText = content
        .filter((part: { type: string; [key: string]: unknown }) => part.type === "text")
        .map((part: { type: string; [key: string]: unknown }) => {
          const textPart = part as { text?: string };
          return String(textPart.text ?? "");
        })
        .join(" ");
    } else {
      message = String(content);
      messageText = message;
    }
  } else {
    message = String(rawMessage ?? "");
    messageText = message;
  }

  logger.info("Chat request received", {
    module: "chat",
    requestId,
    sessionId: session.sessionId,
    messageLength: messageText.length,
    hasMultimodal: Array.isArray(message),
  });

  // Get workspace directory from Instance context
  const directory = instanceContext?.directory;
  if (!directory) {
    return c.json({ error: "No workspace directory" }, 400);
  }

  logger.debug("Creating RLM actor", {
    module: "chat",
    directory,
    sessionId: session.sessionId,
  });

  // Create XState actor for the RLM workflow
  const actor = createRLMActor({
    goal: messageText || "[Multimodal message]",
    messages: [
      {
        role: "user",
        content: message,
      },
    ],
    workspace: directory,
  });

  // Create UIMessage stream
  if (shouldStream) {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Send session message if new session
        if (sessionIsNew) {
          writer.write(createSessionMessage(session));
        }

        const messageId = uuidv7();
        let lastTextDelta = "";
        let finishWritten = false;
        let isComplete = false;

        // Subscribe to state changes
        const subscription = actor.subscribe({
          next: snapshot => {
            // Extract assistant messages
            const messages = snapshot.context.messages;
            const lastMessage = messages[messages.length - 1];

            if (lastMessage?.role === "assistant") {
              // Check for new text delta
              // Assistant messages always have string content
              const content = getTextContent(lastMessage);
              const newDelta = content.slice(lastTextDelta.length);
              if (newDelta.length > 0) {
                writer.write({
                  type: "text-delta",
                  id: messageId,
                  delta: newDelta,
                });
                lastTextDelta = content;
              }
            }

            // Check for completion (write only once)
            if (!finishWritten && (snapshot.matches("done") || snapshot.matches("failed"))) {
              finishWritten = true;
              isComplete = true;
              writer.write({
                type: "finish",
                finishReason: snapshot.matches("done") ? "stop" : "error",
              });
            }
          },
          error: (error: unknown) => {
            if (!finishWritten) {
              finishWritten = true;
              isComplete = true;
              writer.write({
                type: "error",
                errorText: error instanceof Error ? error.message : String(error),
              });
            }
          },
          complete: () => {
            isComplete = true;
          },
        });

        // Start the actor
        actor.start();

        // Wait for completion (timeout: 10 minutes)
        await new Promise<void>((resolve, reject) => {
          const startTime = Date.now();
          const timeoutMs = 10 * 60 * 1000;

          const checkInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed > timeoutMs) {
              clearInterval(checkInterval);
              subscription.unsubscribe();
              actor.stop();
              reject(new Error("Agent execution timeout"));
              return;
            }

            if (isComplete) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
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

export default app;
