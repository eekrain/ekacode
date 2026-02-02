/**
 * Workflow types
 *
 * Type definitions for the workflow orchestration engine.
 */

import { AgentEvent, AgentResult } from "../agent/workflow/types";
import { SessionPhase } from "../session/types";

/**
 * Workflow event types emitted by the engine
 */
export type WorkflowEvent =
  | { type: "PHASE_STARTED"; sessionId: string; phase: SessionPhase }
  | { type: "PHASE_COMPLETED"; sessionId: string; phase: SessionPhase; results?: unknown }
  | { type: "WORKFLOW_COMPLETED"; sessionId: string; results: WorkflowResults }
  | { type: "AGENT_EVENT"; sessionId: string; event: AgentEvent };

/**
 * Workflow results containing all phase outputs
 */
export interface WorkflowResults {
  explore: AgentResult[];
  plan: AgentResult | null;
  build: AgentResult | null;
}

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  sessionId: string;
  task: string;
  exploreInputs?: string[];
}

/**
 * Checkpoint saver callback type
 */
export type CheckpointSaver = (checkpoint: import("../session/types").Checkpoint) => Promise<void>;
