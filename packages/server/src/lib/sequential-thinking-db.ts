/**
 * Sequential Thinking Database Helper (Server Package)
 *
 * This module provides database-backed storage for the sequential thinking tool.
 * It uses the existing tool_sessions table to persist session data across restarts.
 *
 * The sequential thinking sessions are stored with:
 * - tool_name: "sequential-thinking"
 * - tool_key: "default" (for now, could be extended for multiple sessions)
 * - data: JSON containing the serialized session (thoughts, branches, etc.)
 */

import type { DatabaseStorageConfig, SessionSerialized } from "@ekacode/core/tools";
import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

// Import db schema - use package path for consistency
import { db, toolSessions } from "@ekacode/server/db";

/**
 * Tool session data as stored in tool_sessions.data
 */
interface ToolSessionData {
  id: string;
  createdAt: number;
  lastAccessed: number;
  thoughts: Array<{
    thoughtNumber: number;
    thought: string;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
    isRevision?: boolean;
    revisesThought?: number;
    branchFromThought?: number;
    branchId?: string;
    needsMoreThoughts?: boolean;
    timestamp: number;
  }>;
  branches: string[];
}

/**
 * Sequential thinking database storage configuration
 *
 * Implements the DatabaseStorageConfig interface from @ekacode/core/tools
 */
export const sequentialThinkingDbStorage: DatabaseStorageConfig = {
  /**
   * Get a sequential thinking session from the database
   */
  async getToolSession(sessionId: string): Promise<SessionSerialized | null> {
    const result = await db
      .select()
      .from(toolSessions)
      .where(
        and(
          eq(toolSessions.session_id, sessionId),
          eq(toolSessions.tool_name, "sequential-thinking"),
          eq(toolSessions.tool_key, "default")
        )
      )
      .get();

    if (!result) {
      return null;
    }

    // The data field contains the serialized session
    const data = result.data as ToolSessionData;
    return {
      id: data.id,
      createdAt: data.createdAt,
      lastAccessed: data.lastAccessed,
      thoughts: data.thoughts,
      branches: data.branches,
    };
  },

  /**
   * Save or update a sequential thinking session in the database
   *
   * Uses INSERT ... ON CONFLICT DO UPDATE for upsert behavior
   */
  async saveToolSession(session: SessionSerialized): Promise<void> {
    const toolSessionId = uuidv7();
    const now = new Date(session.lastAccessed);

    // Try to insert, but update if exists
    await db
      .insert(toolSessions)
      .values({
        tool_session_id: toolSessionId,
        session_id: session.id,
        tool_name: "sequential-thinking",
        tool_key: "default",
        data: session as unknown as undefined, // Store as JSON
        created_at: now,
        last_accessed: now,
      })
      .onConflictDoUpdate({
        target: [toolSessions.session_id, toolSessions.tool_name, toolSessions.tool_key],
        set: {
          data: session as unknown as undefined,
          last_accessed: now,
        },
      });
  },

  /**
   * Delete a sequential thinking session from the database
   */
  async deleteToolSession(sessionId: string): Promise<void> {
    await db
      .delete(toolSessions)
      .where(
        and(
          eq(toolSessions.session_id, sessionId),
          eq(toolSessions.tool_name, "sequential-thinking"),
          eq(toolSessions.tool_key, "default")
        )
      );
  },

  /**
   * List all sequential thinking session IDs
   */
  async listToolSessions(): Promise<string[]> {
    const results = await db
      .select({ session_id: toolSessions.session_id })
      .from(toolSessions)
      .where(
        and(eq(toolSessions.tool_name, "sequential-thinking"), eq(toolSessions.tool_key, "default"))
      );

    return results.map((r: { session_id: string }) => r.session_id);
  },

  /**
   * Clear all sequential thinking sessions
   */
  async clearToolSessions(): Promise<void> {
    await db
      .delete(toolSessions)
      .where(
        and(eq(toolSessions.tool_name, "sequential-thinking"), eq(toolSessions.tool_key, "default"))
      );
  },
};

/**
 * Re-export for convenience in other server modules
 */
export { sequentialThinkingDbStorage as dbStorage };
