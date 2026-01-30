/**
 * XState RLM Workflow - Central Entry Point
 *
 * This module exports all state machine components for external use
 * by the server package and other consumers.
 *
 * Exports:
 * - rlmMachine: Core hierarchical state machine
 * - createRLMActor: Factory function to create XState actors
 * - runRLMWorkflow: Run workflow and await completion
 * - Actors: Plan, Build, and Explore agents
 * - Loop control: Intent-based iteration control
 * - Types: All state machine types
 */

// ============================================================================
// CORE STATE MACHINE EXPORTS
// ============================================================================

export { rlmMachine } from "./machine";

// ============================================================================
// INTEGRATION ENTRY POINTS
// ============================================================================

export {
  createRLMActor,
  runRLMWorkflow,
  type RLMConfig,
  type RLMResult,
} from "./integration/hybrid-agent";

// ============================================================================
// LOOP CONTROL UTILITIES
// ============================================================================

export { PHASE_SAFETY_LIMITS, checkLoopControl } from "./loop-control";

// ============================================================================
// ACTORS
// ============================================================================

export { runBuildAgent, runPlanAgent, spawnExploreAgent } from "./actors";

export type {
  BuildAgentInput,
  BuildAgentOutput,
  ExploreAgentInput,
  ExploreAgentOutput,
  PlanAgentInput,
  PlanAgentOutput,
} from "./actors";

// ============================================================================
// TYPES
// ============================================================================

export type {
  // State types
  AgentMode,
  // Runtime types
  AgentRuntime,
  AssistantMessage,
  BaseMessage,
  BuildPhase,
  HierarchicalState,
  // Message types
  Message,
  MessageRole,
  PlanPhase,
  RLMMachineContext,
  RLMMachineEvent,
  // Context types
  RecentStateEntry,
  TerminalState,
  ToolCall,
  ToolMessage,
  ToolResult,
} from "./types";

// ============================================================================
// UTILITIES
// ============================================================================

export { getTextContent, hasImageContent, toCoreMessages } from "./types";
