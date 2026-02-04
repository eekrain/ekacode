/**
 * Chat API - AI chat endpoint with session management
 *
 * Handles chat requests with session bridge integration and UIMessage streaming.
 * Integrates with new SessionManager for simplified agent orchestration.
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
 * Custom stream event types for agent communication
 * These are not standard AI SDK UIMessageChunk types but custom protocol
 */
interface TextDeltaEvent {
  type: "text-delta";
  id: string;
  delta: string;
}

interface ToolCallEvent {
  type: "tool-call";
  id: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface ToolResultEvent {
  type: "tool-result";
  id: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
}

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
 * Uses SessionManager and SessionController for simplified agent orchestration.
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
    logger.info("Creating UIMessage stream", {
      module: "chat",
      sessionId: session.sessionId,
      messageId: session.sessionId,
    });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        logger.info("Stream execute started", {
          module: "chat",
          sessionId: session.sessionId,
        });

        // Send session message if new session
        if (sessionIsNew) {
          logger.info("Sending session message", { module: "chat", sessionId: session.sessionId });
          writer.write(createSessionMessage(session));
        }

        const messageId = uuidv7();
        let _isComplete = false;

        // Check if AI provider is configured
        if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
          logger.error("No AI provider configured", undefined, {
            module: "chat",
            sessionId: session.sessionId,
          });
          writer.write({
            type: "error",
            errorText:
              "No AI provider configured. Please set ZAI_API_KEY or OPENAI_API_KEY environment variable.",
          });
          writer.write({
            type: "finish",
            finishReason: "error",
          });
          return;
        }

        logger.info("Starting agent execution", {
          module: "chat",
          sessionId: session.sessionId,
          messageId,
          task: messageText,
        });

        try {
          // Send initial state update
          writer.write({
            type: "data-state",
            id: "state",
            data: {
              state: "running",
              iteration: 0,
              toolExecutionCount: 0,
            },
          });

          // Process the message with agent and stream events
          const result = await controller.processMessage(messageText, {
            onEvent: event => {
              // Forward agent events to the stream
              logger.debug("Agent event received", {
                module: "chat",
                sessionId: session.sessionId,
                eventType: event.type,
              });

              // Handle text content from agent
              if (event.type === "text") {
                writer.write({
                  type: "text-delta",
                  id: messageId,
                  delta: event.text,
                } as TextDeltaEvent);
              }

              // Handle tool-call events - notify UI that a tool is being called
              if (event.type === "tool-call") {
                logger.info(`Tool call: ${event.toolName}`, {
                  module: "chat",
                  sessionId: session.sessionId,
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                });
                writer.write({
                  type: "tool-call",
                  id: messageId,
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  args: event.args,
                } as ToolCallEvent);
              }

              // Handle tool-result events - notify UI that a tool completed
              if (event.type === "tool-result") {
                logger.info(`Tool result: ${event.toolName}`, {
                  module: "chat",
                  sessionId: session.sessionId,
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                });
                writer.write({
                  type: "tool-result",
                  id: messageId,
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  result: event.result,
                } as ToolResultEvent);
              }

              // Handle finish events
              if (event.type === "finish") {
                logger.debug(`Agent finish: ${event.finishReason}`, {
                  module: "chat",
                  sessionId: session.sessionId,
                  finishReason: event.finishReason,
                });
              }
            },
          });

          _isComplete = true;

          if (result.status === "failed") {
            logger.error("Agent execution failed", undefined, {
              module: "chat",
              sessionId: session.sessionId,
              messageId,
              error: result.error,
              hasContent: !!result.finalContent,
            });
          } else {
            logger.info("Agent execution completed", {
              module: "chat",
              sessionId: session.sessionId,
              status: result.status,
              hasContent: !!result.finalContent,
            });
          }

          // Send final content if available
          if (result.finalContent) {
            writer.write({
              type: "text-delta",
              id: messageId,
              delta: result.finalContent,
            });
          }

          // Send final status message
          writer.write({
            type: "data-state",
            id: "state",
            data: {
              state: result.status === "completed" ? "completed" : "failed",
              iteration: 0,
              toolExecutionCount: 0,
            },
          });

          // Send finish message
          writer.write({
            type: "finish",
            finishReason: result.status === "completed" ? "stop" : "error",
          });
        } catch (error) {
          _isComplete = true;
          const errorMessage = error instanceof Error ? error.message : String(error);

          logger.error("Agent execution error", error instanceof Error ? error : undefined, {
            sessionId: session.sessionId,
            error: errorMessage,
          });

          writer.write({
            type: "error",
            errorText: errorMessage,
          });

          writer.write({
            type: "finish",
            finishReason: "error",
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
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Session-ID, X-Workspace, X-Directory",
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
