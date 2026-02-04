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

/**
 * Antigravity UI - Mode detection and data streaming
 */
type AgentMode = "planning" | "build" | "chat";
type AgentEventKind =
  | "thought"
  | "note"
  | "analyzed"
  | "created"
  | "edited"
  | "deleted"
  | "terminal"
  | "error"
  | "tool";

/**
 * Event actions for user interaction
 */
type AgentEventAction =
  | { type: "open-file"; path: string; line?: number }
  | { type: "open-diff"; path: string }
  | { type: "open-terminal"; id: string }
  | { type: "open-url"; url: string };

/**
 * Canonical agent event (used in both planning and build modes)
 */
interface AgentEvent {
  /** Unique event ID */
  id: string;
  /** Timestamp (ms since epoch) */
  ts: number;
  /** Event kind determines icon and styling */
  kind: AgentEventKind;
  /** Primary display text (e.g., "Read file.ts") */
  title: string;
  /** Secondary text (e.g., file path, command output preview) */
  subtitle?: string;
  /** File info for file-related events */
  file?: {
    path: string;
    range?: string;
  };
  /** Diff stats for edit events */
  diff?: {
    plus: number;
    minus: number;
  };
  /** Terminal info for shell events */
  terminal?: {
    command: string;
    cwd?: string;
    outputPreview: string;
    exitCode?: number;
    background?: boolean;
  };
  /** Error info */
  error?: {
    message: string;
    details?: string;
  };
  /** Available actions for this event */
  actions?: AgentEventAction[];
  /** Tool call ID for linking to tool-result */
  toolCallId?: string;
  /** Agent ID that produced this event */
  agentId?: string;
}

/**
 * Run Card data for planning mode aggregated view
 */
interface RunCardData {
  /** Unique run ID */
  runId: string;
  /** Run title (e.g., "Planning Authentication") */
  title: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Current status */
  status: "planning" | "executing" | "done" | "error";
  /** Ordered list of edited file paths */
  filesEditedOrder: string[];
  /** Ordered list of progress group IDs */
  groupsOrder: string[];
  /** Whether all groups are collapsed */
  collapsedAll?: boolean;
  /** Start timestamp */
  startedAt?: number;
  /** First significant update timestamp */
  firstSignificantUpdateAt?: number;
  /** Finish timestamp */
  finishedAt?: number;
  /** Duration in ms */
  elapsedMs?: number;
}

interface ModeState {
  mode: AgentMode;
  runId: string | null;
  hasToolCalls: boolean;
  hasReasoning: boolean;
  reasoningTexts: Map<string, string>; // Track reasoning text by ID
  runCardData: RunCardData | null;
}

/**
 * Map tool name to AgentEventKind
 */
function mapToolToKind(toolName: string): AgentEventKind {
  if (toolName === "write_to_file") return "created";
  if (toolName === "replace_file_content") return "edited";
  if (toolName === "multi_replace_file_content") return "edited";
  if (toolName === "run_command") return "terminal";
  if (toolName === "grep_search") return "analyzed";
  if (toolName === "find_by_name") return "analyzed";
  if (toolName === "view_file") return "analyzed";
  return "tool";
}

/**
 * Format tool call as human-readable title
 */
function formatToolTitle(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "write_to_file") {
    const path = (args.TargetFile as string) || "";
    return `Created ${path.split("/").pop()}`;
  }
  if (toolName === "replace_file_content" || toolName === "multi_replace_file_content") {
    const path = (args.TargetFile as string) || "";
    return `Edited ${path.split("/").pop()}`;
  }
  if (toolName === "run_command") {
    const cmd = (args.CommandLine as string) || "";
    return `Running: ${cmd.slice(0, 50)}${cmd.length > 50 ? "..." : ""}`;
  }
  if (toolName === "grep_search") {
    const query = (args.Query as string) || "";
    return `Searching for "${query}"`;
  }
  if (toolName === "view_file") {
    const path = (args.AbsolutePath as string) || "";
    return `Viewing ${path.split("/").pop()}`;
  }
  return toolName.replace(/_/g, " ");
}

/**
 * Format tool subtitle with additional context
 */
function formatToolSubtitle(toolName: string, args: Record<string, unknown>): string | undefined {
  if (toolName === "write_to_file" || toolName.includes("replace")) {
    const path = (args.TargetFile as string) || "";
    const dir = path.split("/").slice(0, -1).join("/");
    return dir ? `in ${dir}` : undefined;
  }
  if (toolName === "run_command") {
    const cwd = (args.Cwd as string) || "";
    return cwd ? `in ${cwd}` : undefined;
  }
  return undefined;
}

/**
 * Create actions for tool events
 */
function createToolActions(toolName: string, args: Record<string, unknown>): AgentEventAction[] {
  const actions: AgentEventAction[] = [];

  if (toolName.includes("file") && args.TargetFile) {
    actions.push({
      type: "open-file",
      path: args.TargetFile as string,
      line: args.StartLine as number | undefined,
    });
  }

  if (toolName === "view_file" && args.AbsolutePath) {
    actions.push({
      type: "open-file",
      path: args.AbsolutePath as string,
      line: args.Offset as number | undefined,
    });
  }

  if (toolName === "run_command") {
    actions.push({
      type: "open-terminal",
      id: "terminal-1", // Would need actual terminal ID tracking
    });
  }

  return actions;
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
          // Initialize mode state for Antigravity UI
          const modeState: ModeState = {
            mode: "chat",
            runId: null,
            hasToolCalls: false,
            hasReasoning: false,
            reasoningTexts: new Map(),
            runCardData: null,
          };

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

          // Helper function to detect agent mode based on events
          const detectMode = (state: ModeState, eventType: string): AgentMode => {
            // Planning mode: reasoning without tool execution
            if (eventType === "reasoning-start" && !state.hasToolCalls) {
              return "planning";
            }

            // Build mode: tool execution detected
            if (eventType === "tool-call") {
              return "build";
            }

            // Chat mode: simple text response (default)
            return state.mode || "chat";
          };

          // Helper function to create AgentEvent from tool call
          const createAgentEvent = (
            event: { toolCallId: string; toolName: string; args: unknown },
            agentId?: string
          ): AgentEvent => {
            const args = (event.args as Record<string, unknown>) || {};
            const kind = mapToolToKind(event.toolName);
            const title = formatToolTitle(event.toolName, args);
            const subtitle = formatToolSubtitle(event.toolName, args);

            const agentEvent: AgentEvent = {
              id: event.toolCallId,
              ts: Date.now(),
              kind,
              title,
              subtitle,
              toolCallId: event.toolCallId,
              agentId,
            };

            // Add file info for file-related events
            if (event.toolName.includes("file") && args.TargetFile) {
              agentEvent.file = {
                path: args.TargetFile as string,
              };
            }

            // Add terminal info for shell events
            if (event.toolName === "run_command") {
              agentEvent.terminal = {
                command: (args.CommandLine as string) || "",
                cwd: (args.Cwd as string) || undefined,
                outputPreview: "",
              };
            }

            // Add actions for user interaction
            agentEvent.actions = createToolActions(event.toolName, args);

            return agentEvent;
          };

          // Process the message with agent and stream events
          const result = await controller.processMessage(messageText, {
            onEvent: event => {
              // Forward agent events to the stream
              logger.debug("Agent event received", {
                module: "chat",
                sessionId: session.sessionId,
                eventType: event.type,
              });

              // Update mode detection
              const newMode = detectMode(modeState, event.type);
              if (newMode !== modeState.mode) {
                modeState.mode = newMode;
                logger.info(`Mode transition: ${modeState.mode} → ${newMode}`, {
                  module: "chat",
                  sessionId: session.sessionId,
                });

                // Send mode change metadata
                writer.write({
                  type: "message-metadata",
                  messageMetadata: {
                    mode: newMode,
                    runId: modeState.runId,
                    startedAt: Date.now(),
                  },
                });

                // Initialize run card if entering planning mode
                if (newMode === "planning" && !modeState.runId) {
                  modeState.runId = uuidv7();
                  modeState.runCardData = {
                    runId: modeState.runId,
                    title: "Planning Session",
                    status: "planning",
                    subtitle: messageText.slice(0, 100),
                    filesEditedOrder: [],
                    groupsOrder: [],
                    startedAt: Date.now(),
                  };

                  writer.write({
                    type: "data-run",
                    id: messageId,
                    data: modeState.runCardData,
                  } as unknown as Parameters<typeof writer.write>[0]);
                }
              }

              // Handle text content from agent
              if (event.type === "text") {
                writer.write({
                  type: "text-delta",
                  id: messageId,
                  delta: event.text,
                } as TextDeltaEvent);
              }

              // Handle reasoning events → data-thought
              if (event.type === "reasoning-start") {
                modeState.hasReasoning = true;
                const reasoningId = event.reasoningId as string;
                modeState.reasoningTexts.set(reasoningId, "");

                writer.write({
                  type: "data-thought",
                  id: messageId,
                  data: {
                    id: reasoningId,
                    status: "thinking",
                    text: "",
                    agentId: event.agentId as string | undefined,
                  },
                } as unknown as Parameters<typeof writer.write>[0]);
              }

              if (event.type === "reasoning-delta") {
                const reasoningId = event.reasoningId as string;
                const currentText = modeState.reasoningTexts.get(reasoningId) || "";
                const newText = currentText + (event.text as string);
                modeState.reasoningTexts.set(reasoningId, newText);

                writer.write({
                  type: "data-thought",
                  id: messageId,
                  data: {
                    id: reasoningId,
                    status: "thinking",
                    text: newText,
                    agentId: event.agentId as string | undefined,
                  },
                } as unknown as Parameters<typeof writer.write>[0]);
              }

              if (event.type === "reasoning-end") {
                const reasoningId = event.reasoningId as string;
                modeState.reasoningTexts.delete(reasoningId);

                writer.write({
                  type: "data-thought",
                  id: messageId,
                  data: {
                    id: reasoningId,
                    status: "complete",
                    durationMs: event.durationMs as number,
                    agentId: event.agentId,
                  },
                } as unknown as Parameters<typeof writer.write>[0]);
              }

              // Handle tool-call events → data-action (build mode)
              if (event.type === "tool-call") {
                modeState.hasToolCalls = true;

                logger.info(`Tool call: ${event.toolName}`, {
                  module: "chat",
                  sessionId: session.sessionId,
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                });

                // Send standard tool event
                writer.write({
                  type: "tool-input-available",
                  toolCallId: event.toolCallId as string,
                  toolName: event.toolName as string,
                  input: event.args,
                });

                // Create and send AgentEvent as data-action
                const agentEvent = createAgentEvent(
                  {
                    toolCallId: event.toolCallId as string,
                    toolName: event.toolName as string,
                    args: event.args,
                  },
                  event.agentId as string | undefined
                );
                writer.write({
                  type: "data-action",
                  id: messageId,
                  data: agentEvent,
                } as unknown as Parameters<typeof writer.write>[0]);

                // Also emit as data-run-item for planning mode
                if (modeState.mode === "planning" && modeState.runId) {
                  writer.write({
                    type: "data-run-item",
                    id: messageId,
                    data: agentEvent,
                  } as unknown as Parameters<typeof writer.write>[0]);

                  // Update run card with file info if applicable
                  if (agentEvent.file?.path && modeState.runCardData) {
                    if (!modeState.runCardData.filesEditedOrder.includes(agentEvent.file.path)) {
                      modeState.runCardData.filesEditedOrder.push(agentEvent.file.path);
                      writer.write({
                        type: "data-run",
                        id: messageId,
                        data: modeState.runCardData,
                      } as unknown as Parameters<typeof writer.write>[0]);
                    }
                  }
                }
              }

              // Handle tool-result events → update action
              if (event.type === "tool-result") {
                logger.info(`Tool result: ${event.toolName}`, {
                  module: "chat",
                  sessionId: session.sessionId,
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                });

                // Send standard tool result
                writer.write({
                  type: "tool-output-available",
                  toolCallId: event.toolCallId as string,
                  output: event.result,
                });

                // Update action with result info
                const resultText =
                  typeof event.result === "string" ? event.result : JSON.stringify(event.result);
                writer.write({
                  type: "data-action",
                  id: messageId,
                  data: {
                    id: event.toolCallId as string,
                    ts: Date.now(),
                    kind: "tool",
                    title: `${event.toolName as string} completed`,
                    subtitle: resultText.slice(0, 100),
                    toolCallId: event.toolCallId as string,
                    agentId: event.agentId as string | undefined,
                  },
                } as unknown as Parameters<typeof writer.write>[0]);
              }

              // Handle finish events
              if (event.type === "finish") {
                logger.debug(`Agent finish: ${event.finishReason}`, {
                  module: "chat",
                  sessionId: session.sessionId,
                  finishReason: event.finishReason,
                });

                // Update run card status if in planning mode
                if (modeState.mode === "planning" && modeState.runCardData) {
                  modeState.runCardData.status = "done";
                  modeState.runCardData.finishedAt = Date.now();
                  if (modeState.runCardData.startedAt) {
                    modeState.runCardData.elapsedMs = Date.now() - modeState.runCardData.startedAt;
                  }
                  writer.write({
                    type: "data-run",
                    id: messageId,
                    data: modeState.runCardData,
                  } as unknown as Parameters<typeof writer.write>[0]);
                }
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
