/**
 * Agent workflow types
 *
 * Core type definitions for agents and workflow orchestration.
 * These types are shared across the agent system.
 */

import type { LanguageModelV3 } from "@ai-sdk/provider";

/**
 * Agent types for different phases
 */
export type AgentType = "explore" | "plan" | "build";

/**
 * Agent event types emitted during execution
 */
export type AgentEvent =
  | { type: "text"; text: string; agentId: string }
  | { type: "tool-call"; toolName: string; args: Record<string, unknown>; agentId: string }
  | { type: "tool-result"; toolName: string; result: unknown; agentId: string }
  | { type: "finish"; finishReason: string; agentId: string };

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Unique identifier for this agent instance */
  id: string;
  /** Agent type (explore, plan, build) */
  type: AgentType;
  /** Model identifier or instance */
  model: string | LanguageModelV3;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Tools available to the agent */
  tools: unknown[];
  /** Maximum iterations before giving up */
  maxIterations: number;
  /** Optional temperature for LLM */
  temperature?: number;
}

/**
 * Input to an agent execution
 */
export interface AgentInput {
  /** The task or prompt for the agent */
  task: string;
  /** Additional context for the agent */
  context?: Record<string, unknown>;
  /** Previous results from other agents */
  previousResults?: Array<{
    agentId: string;
    type: AgentType;
    status: "completed" | "failed" | "stopped";
    messages: unknown[];
    iterations: number;
    duration: number;
    finalContent?: string;
    error?: string;
  }>;
}

/**
 * Result from an agent execution
 */
export interface AgentResult {
  /** The agent's ID */
  agentId: string;
  /** The agent's type */
  type: AgentType;
  /** Execution status */
  status: "completed" | "failed" | "stopped";
  /** Message history from the execution */
  messages: unknown[];
  /** Final content if successful */
  finalContent?: string;
  /** Error message if failed */
  error?: string;
  /** Number of iterations */
  iterations: number;
  /** Duration in milliseconds */
  duration: number;
}
