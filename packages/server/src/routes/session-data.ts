/**
 * Session Data API - Historical message retrieval
 *
 * Provides endpoints for fetching historical messages for a session.
 * Follows Opencode SDK pattern with pagination support.
 *
 * Opencode SDK equivalent: client.session.messages({ sessionID, limit })
 */

import { readFile } from "fs/promises";
import { Hono } from "hono";
import { join } from "path";
import { z } from "zod";
import type { Env } from "../index";
import { getSessionManager } from "../runtime";

const app = new Hono<Env>();

/**
 * Schema for session.messages request
 * Matches Opencode SDK pattern
 */
const sessionMessagesSchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * Checkpoint data structure
 */
interface Checkpoint {
  sessionId: string;
  phase: string;
  task: string;
  timestamp: number;
  result?: {
    agentId: string;
    type: string;
    status: string;
    messages?: unknown[];
    finalContent?: string;
    iterations?: number;
    duration?: number;
  };
}

/**
 * Opencode-style Message format for API response
 * Simplified version that matches our core Message types
 */
interface MessageInfo {
  role: "user" | "assistant" | "system";
  id: string;
  sessionID?: string;
  time?: {
    created: number;
    completed?: number;
  };
}

interface Part {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  [key: string]: unknown;
}

interface MessageResponse {
  info: MessageInfo;
  parts: Part[];
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Get messages for a session
 *
 * Usage:
 * GET /api/chat/:sessionId/messages?limit=100&offset=0
 *
 * Returns:
 * {
 *   sessionID: string,
 *   messages: [{ info, parts, createdAt, updatedAt }],
 *   hasMore: boolean
 * }
 *
 * Opencode SDK equivalent:
 * client.session.messages({ sessionID, limit })
 */
app.get("/api/chat/:sessionId/messages", async c => {
  const sessionId = c.req.param("sessionId");

  try {
    // Parse query parameters
    const query = sessionMessagesSchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "Invalid query parameters", issues: query.error.issues }, 400);
    }
    const { limit, offset } = query.data;

    // Get session manager and controller
    const sessionManager = getSessionManager();
    const controller = await sessionManager.getSession(sessionId);

    if (!controller) {
      return c.json({ error: "Session not found" }, 404);
    }

    // Check if checkpoint exists
    const hasCheckpoint = await controller.hasCheckpoint();
    if (!hasCheckpoint) {
      return c.json({
        sessionID: sessionId,
        messages: [],
        hasMore: false,
      });
    }

    // Read checkpoint file
    const checkpointPath = join("./checkpoints", sessionId, "checkpoint.json");
    const checkpointData = await readFile(checkpointPath, "utf-8");
    const checkpoint = JSON.parse(checkpointData) as Checkpoint;

    // Extract messages from checkpoint
    const rawMessages = checkpoint.result?.messages || [];

    // Convert to Opencode-style format
    const messages: MessageResponse[] = rawMessages
      .slice(offset, offset + limit)
      .map((msg: unknown) => {
        // Handle both core Message format and existing formats
        const m = msg as Record<string, unknown>;
        if (m.info && m.parts) {
          // Core Message format
          return {
            info: m.info as MessageInfo,
            parts: m.parts as Part[],
            createdAt: m.createdAt as number | undefined,
            updatedAt: m.updatedAt as number | undefined,
          };
        }
        // Legacy format conversion - ensure role is properly typed
        const role = (m.role as string) || "user";
        const validRole = ["user", "assistant", "system"].includes(role)
          ? (role as "user" | "assistant" | "system")
          : "user";

        return {
          info: {
            role: validRole,
            id: (m.id as string) || sessionId,
            sessionID: sessionId,
          },
          parts: (m.parts as Part[]) || [],
          createdAt: m.createdAt as number | undefined,
        };
      });

    const hasMore = offset + limit < rawMessages.length;

    return c.json({
      sessionID: sessionId,
      messages,
      hasMore,
      total: rawMessages.length,
    });
  } catch (error) {
    console.error("Failed to fetch session messages:", error);
    return c.json({ error: "Failed to fetch session messages" }, 500);
  }
});

export default app;
