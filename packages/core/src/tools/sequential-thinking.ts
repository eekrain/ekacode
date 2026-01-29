/**
 * Sequential Thinking Tool - Native AI SDK v6 Implementation
 *
 * Provides multi-turn reasoning capability for AI agents with support for
 * revision, branching, and iterative refinement.
 *
 * Session Pattern: Agent owns sessionId, tool is stateless between calls.
 * This makes the tool pluggable to any orchestration layer (XState, sub-agents, etc).
 */

import { tool, zodSchema } from "ai";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * A single thought entry in the session history
 */
type ThoughtEntry = {
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
};

/**
 * A sequential thinking session
 */
export type Session = {
  id: string;
  createdAt: number;
  thoughts: ThoughtEntry[];
  branches: Set<string>;
};

// ============================================================================
// SESSION STORE (In-memory, replaceable with Redis/DB/etc)
// ============================================================================

// TODO: Replace in-memory Map with Drizzle persistence for production.
// The spec calls for tool_sessions table storage to survive server restarts.
// Current implementation is suitable for development and single-instance deployments.
const sessions = new Map<string, Session>();

// Auto-cleanup old sessions (30 minute TTL)
const SESSION_TTL_MS = 30 * 60 * 1000;

// Session limits for defensive programming
const MAX_THOUGHTS_PER_SESSION = 1000;
const MAX_THOUGHT_LENGTH = 50000;

// Use Node.js timer for cleanup
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

if (typeof clearInterval !== "undefined" && typeof setInterval !== "undefined") {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(id);
      }
    }
  }, SESSION_TTL_MS);

  // Register cleanup handlers for graceful shutdown
  if (typeof process !== "undefined") {
    const shutdownHandler = () => {
      stopCleanupTimer();
    };
    process.on("beforeExit", shutdownHandler);
    process.on("SIGINT", shutdownHandler);
    process.on("SIGTERM", shutdownHandler);
  }
}

// ============================================================================
// OUTPUT SCHEMA
// ============================================================================

const sequentialThinkingOutputSchema = z.object({
  sessionId: z.string().describe("Session ID for next call"),
  thoughtNumber: z.number(),
  totalThoughts: z.number(),
  nextThoughtNeeded: z.boolean(),
  thoughtHistory: z
    .array(
      z.object({
        thoughtNumber: z.number(),
        thought: z.string(),
        isRevision: z.boolean().optional(),
      })
    )
    .describe("Full thought history for context"),
  branches: z.array(z.string()).describe("Active branch IDs"),
  thoughtHistoryLength: z.number().describe("Total thoughts in session"),
  summary: z.string().optional().describe("Optional summary of thinking so far"),
});

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * Creates a sequential thinking tool instance
 *
 * @param options - Optional configuration
 * @param options.sessionId - Initial session ID for continuation
 * @returns AI SDK tool definition
 */
export const createSequentialThinkingTool = (options: { sessionId?: string } = {}) =>
  tool({
    description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- You can adjust totalThoughts up or down as you progress
- You can question or revise previous thoughts
- You can add more thoughts even after reaching what seemed like the end
- You can express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - you can branch or backtrack

Parameters explained:
- thought: Your current thinking step
- nextThoughtNeeded: True if you need more thinking
- thoughtNumber: Current number in sequence (can go beyond initial total)
- totalThoughts: Current estimate (can be adjusted up/down)
- sessionId: Pass existing session ID to continue, or omit for new session
- isRevision, revisesThought, branchFromThought, branchId: Optional branching/revision
- clearSession: Set true to reset and start fresh

You should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
3. Don't hesitate to add more thoughts if needed, even at the "end"
4. Express uncertainty when present
5. Mark thoughts that revise previous thinking or branch into new paths
6. Ignore information that is irrelevant to the current step
7. Only set nextThoughtNeeded to false when truly done`,

    inputSchema: zodSchema(
      z.object({
        thought: z.string().describe("Your current thinking step"),
        nextThoughtNeeded: z.boolean().describe("Whether another thought step is needed"),
        thoughtNumber: z.number().int().min(1).describe("Current thought number (e.g., 1, 2, 3)"),
        totalThoughts: z
          .number()
          .int()
          .min(1)
          .describe("Estimated total thoughts needed (e.g., 5, 10)"),
        sessionId: z
          .string()
          .optional()
          .describe("Pass existing session ID to continue, or omit for new session"),
        isRevision: z.boolean().optional().describe("Whether this revises previous thinking"),
        revisesThought: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Which thought number is being reconsidered"),
        branchFromThought: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Branching point thought number"),
        branchId: z.string().optional().describe("Branch identifier"),
        needsMoreThoughts: z.boolean().optional().describe("If more thoughts are needed"),
        clearSession: z.boolean().optional().describe("Set true to reset and start fresh"),
      })
    ),

    outputSchema: zodSchema(sequentialThinkingOutputSchema),

    execute: async args => {
      const requestedSessionId = options.sessionId ?? args.sessionId;

      // Clear session if requested
      if (args.clearSession && requestedSessionId) {
        sessions.delete(requestedSessionId);
      }

      // Get or create session
      let sessionId = requestedSessionId;
      let session: Session;

      if (sessionId && sessions.has(sessionId)) {
        session = sessions.get(sessionId)!;
      } else {
        // Generate UUIDv7 for time-ordered, sortable session IDs
        sessionId = uuidv7();

        session = {
          id: sessionId,
          createdAt: Date.now(),
          thoughts: [],
          branches: new Set(),
        };
        sessions.set(sessionId, session);
      }

      // Validate session limits (defensive programming)
      if (session.thoughts.length >= MAX_THOUGHTS_PER_SESSION) {
        throw new Error(`Session exceeds maximum thoughts limit: ${MAX_THOUGHTS_PER_SESSION}`);
      }
      if (args.thought.length > MAX_THOUGHT_LENGTH) {
        throw new Error(`Thought exceeds maximum length: ${MAX_THOUGHT_LENGTH} characters`);
      }

      // Track branches
      if (args.branchId && !session.branches.has(args.branchId)) {
        session.branches.add(args.branchId);
      }

      // Add thought to history
      const thoughtEntry: ThoughtEntry = {
        thoughtNumber: args.thoughtNumber,
        thought: args.thought,
        totalThoughts: args.totalThoughts,
        nextThoughtNeeded: args.nextThoughtNeeded,
        isRevision: args.isRevision,
        revisesThought: args.revisesThought,
        branchFromThought: args.branchFromThought,
        branchId: args.branchId,
        needsMoreThoughts: args.needsMoreThoughts,
        timestamp: Date.now(),
      };
      session.thoughts.push(thoughtEntry);

      // Generate summary if session is complete
      let summary: string | undefined;
      if (!args.nextThoughtNeeded) {
        summary = `Sequential thinking complete: ${session.thoughts.length} thoughts processed across ${session.branches.size} branches.`;
      }

      // Return session state + history for LLM context
      return sequentialThinkingOutputSchema.parse({
        sessionId,
        thoughtNumber: args.thoughtNumber,
        totalThoughts: args.totalThoughts,
        nextThoughtNeeded: args.nextThoughtNeeded,
        thoughtHistory: session.thoughts.map(t => ({
          thoughtNumber: t.thoughtNumber,
          thought: t.thought,
          isRevision: t.isRevision,
        })),
        branches: Array.from(session.branches),
        thoughtHistoryLength: session.thoughts.length,
        summary,
      });
    },
  });

/**
 * Default sequential thinking tool instance
 */
export const sequentialThinking = createSequentialThinkingTool();

// ============================================================================
// CLEANUP UTILITIES
// ============================================================================

/**
 * Clear a specific session
 *
 * @param sessionId - Session ID to clear
 */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Clear all sessions (useful for testing)
 */
export function clearAllSessions(): void {
  sessions.clear();
}

/**
 * Get a session by ID
 *
 * @param sessionId - Session ID to retrieve
 * @returns Session if found, undefined otherwise
 */
export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

/**
 * Get all sessions (returns a copy)
 *
 * @returns Map of all sessions
 */
export function getAllSessions(): Map<string, Session> {
  return new Map(sessions);
}

/**
 * Stop the cleanup timer (useful for clean shutdown)
 */
export function stopCleanupTimer(): void {
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
