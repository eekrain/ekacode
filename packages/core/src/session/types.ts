/**
 * Session types for opencode-style architecture
 *
 * These types define the core interfaces for session management,
 * replacing XState-based workflow with explicit session state.
 */

import { z } from "zod";
import { AgentResult } from "../agent/workflow/types";

/**
 * Session phase enumeration
 */
export const SessionPhase = z.enum(["idle", "running", "completed", "failed"]);
export type SessionPhase = z.infer<typeof SessionPhase>;

/**
 * Session status schema
 */
export const SessionStatus = z.object({
  sessionId: z.string(),
  phase: SessionPhase,
  progress: z.number(), // 0-100
  hasIncompleteWork: z.boolean(),
  summary: z.string(),
  lastActivity: z.number().optional(), // timestamp
  activeAgents: z.array(z.string()),
});
export type SessionStatus = z.infer<typeof SessionStatus>;

/**
 * Session configuration schema
 */
export const SessionConfig = z.object({
  resourceId: z.string(),
  task: z.string(),
  workspace: z.string(),
  exploreInputs: z.array(z.string()).optional(),
});
export type SessionConfig = z.infer<typeof SessionConfig>;

/**
 * Checkpoint schema for session persistence
 */
export const Checkpoint = z.object({
  sessionId: z.string(),
  timestamp: z.number(),
  phase: SessionPhase,
  task: z.string(),
  result: AgentResult.optional(),
});
export type Checkpoint = z.infer<typeof Checkpoint>;
