/**
 * Session manager
 *
 * Manages multiple sessions with persistence and lifecycle handling.
 */

import { access, readFile } from "fs/promises";
import { join } from "path";
import { v7 as uuidv7 } from "uuid";
import { SessionController } from "./controller";
import { Checkpoint, SessionConfig } from "./types";

/**
 * Database interface for session persistence
 */
interface Database {
  insert(table: string): {
    values: (data: Record<string, unknown>) => Promise<void>;
  };
  query: {
    sessions: {
      findMany: (opts: {
        orderBy: (sessions: unknown, { desc }: { desc: (col: unknown) => unknown }) => unknown[];
      }) => Promise<unknown[]>;
      findFirst: (opts: { where: unknown }) => Promise<unknown | undefined>;
    };
  };
}

/**
 * Session manager class
 *
 * Manages multiple concurrent sessions with database
 * persistence and checkpoint management.
 */
export class SessionManager {
  private sessions = new Map<string, SessionController>();
  private db: Database;
  private checkpointBaseDir: string;

  constructor(db: Database, checkpointBaseDir = "./checkpoints") {
    this.db = db;
    this.checkpointBaseDir = checkpointBaseDir;
  }

  /**
   * Initialize manager and load existing sessions
   *
   * Loads all sessions from database on startup.
   * Sessions are loaded in paused state.
   */
  async initialize(): Promise<void> {
    // Load all sessions from database
    const dbSessions = await this.db.query.sessions.findMany({
      orderBy: (_sessions, { desc }) => [desc((s: { last_accessed: unknown }) => s.last_accessed)],
    });

    for (const sessionData of dbSessions as Array<{
      session_id: string;
      resource_id: string;
    }>) {
      const sessionId = sessionData.session_id;
      const checkpointDir = join(this.checkpointBaseDir, sessionId);

      // Try to load checkpoint from disk
      let checkpoint: Checkpoint | null = null;
      try {
        const checkpointPath = join(checkpointDir, "checkpoint.json");
        await access(checkpointPath);
        const data = await readFile(checkpointPath, "utf-8");
        checkpoint = JSON.parse(data) as Checkpoint;
      } catch {
        // No checkpoint file exists
        checkpoint = null;
      }

      // Create controller (paused state)
      const controller = new SessionController({
        sessionId,
        sessionConfig: {
          resourceId: sessionData.resource_id,
          task: checkpoint?.task || "",
          workspace: "",
        },
        checkpointDir,
        restoredCheckpoint: checkpoint,
      });

      this.sessions.set(sessionId, controller);
    }
  }

  /**
   * Create a new session
   *
   * @param config - Session configuration
   * @returns The new session ID
   */
  async createSession(config: SessionConfig): Promise<string> {
    const sessionId = this.generateSessionId();
    const checkpointDir = join(this.checkpointBaseDir, sessionId);

    // Persist to database
    await this.db.insert("sessions").values({
      session_id: sessionId,
      resource_id: config.resourceId,
      status: "idle",
      created_at: new Date(),
      last_accessed: new Date(),
    });

    // Create controller
    const controller = new SessionController({
      sessionId,
      sessionConfig: config,
      checkpointDir,
    });

    this.sessions.set(sessionId, controller);
    return sessionId;
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - The session ID
   * @returns The session controller or undefined
   */
  async getSession(sessionId: string): Promise<SessionController | undefined> {
    // Check memory
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    // Load from database
    const sessionData = (await this.db.query.sessions.findFirst({
      where: { session_id: sessionId },
    })) as { session_id: string; resource_id: string } | undefined;

    if (!sessionData) {
      return undefined;
    }

    // Recreate controller with checkpoint if exists
    const checkpointDir = join(this.checkpointBaseDir, sessionId);
    let checkpoint: Checkpoint | null = null;
    try {
      const checkpointPath = join(checkpointDir, "checkpoint.json");
      await access(checkpointPath);
      const data = await readFile(checkpointPath, "utf-8");
      checkpoint = JSON.parse(data) as Checkpoint;
    } catch {
      // No checkpoint file exists
    }

    const controller = new SessionController({
      sessionId,
      sessionConfig: {
        resourceId: sessionData.resource_id,
        task: checkpoint?.task || "",
        workspace: "",
      },
      checkpointDir,
      restoredCheckpoint: checkpoint,
    });

    this.sessions.set(sessionId, controller);
    return controller;
  }

  /**
   * Get all active sessions (with incomplete work)
   *
   * @returns Array of active session controllers
   */
  getActiveSessions(): SessionController[] {
    return Array.from(this.sessions.values()).filter(session => session.hasIncompleteWork());
  }

  /**
   * Get the total session count
   *
   * @returns Number of sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Generate a unique session ID using UUIDv7
   *
   * @returns A unique session ID
   */
  private generateSessionId(): string {
    return uuidv7();
  }

  /**
   * Delete a session and clean up resources
   *
   * @param sessionId - The session ID to delete
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.abort();
      this.sessions.delete(sessionId);
    }
  }
}
