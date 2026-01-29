/**
 * XState hierarchical state machine types for Plan/Build agent orchestration
 *
 * This module defines the core types for the RLM (Recursive Language Model)
 * workflow system using XState v5.
 */

// ============================================================================
// MESSAGE TYPES (compatible with AI SDK v6)
// ============================================================================

/**
 * Re-export AI SDK v6 core types for convenience
 * These types are used throughout the state machine for message passing.
 */

/**
 * Message role in the conversation
 * Compatible with AI SDK v6 CoreMessage
 */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/**
 * Base message interface (compatible with AI SDK v6)
 */
export interface BaseMessage {
  role: MessageRole;
  content: string;
}

/**
 * Tool call message part
 */
export interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * Tool result message part
 */
export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

/**
 * Message with tool calls
 */
export interface AssistantMessage extends BaseMessage {
  role: "assistant";
  toolCalls?: ToolCall[];
}

/**
 * Message with tool results
 */
export interface ToolMessage extends BaseMessage {
  role: "tool";
  toolCallId: string;
  result: unknown;
}

/**
 * Union type for all message types
 *
 * This is our internal message format used by the state machine.
 * For AI SDK v6 compatibility, we convert to/from CoreMessage when needed.
 */
export type Message = BaseMessage | AssistantMessage | ToolMessage;

// ============================================================================
// RUNTIME TYPES
// ============================================================================

/**
 * Runtime controls for agent execution (testing/cancellation).
 */
export interface AgentRuntime {
  /**
   * Optional abort signal to cancel in-flight actor work.
   */
  signal?: AbortSignal;

  /**
   * Enable test mode to bypass real AI calls.
   */
  testMode?: boolean;
}

/**
 * Convert our internal Message type to AI SDK v6 CoreMessage format
 */
export function toCoreMessages(messages: Array<Message>): Array<Record<string, unknown>> {
  return messages.map(msg => {
    const base = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.role === "assistant" && "toolCalls" in msg) {
      return {
        ...base,
        toolCalls: (msg as AssistantMessage).toolCalls?.map(tc => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        })),
      };
    }

    if (msg.role === "tool") {
      return {
        ...base,
        toolCallId: (msg as ToolMessage).toolCallId,
        result: (msg as ToolMessage).result,
      };
    }

    return base;
  });
}

// ============================================================================
// STATE TYPES
// ============================================================================

/**
 * Agent mode - top-level state in the hierarchical machine
 */
export type AgentMode = "plan" | "build";

/**
 * Plan agent phases - linear progression through planning
 */
export type PlanPhase = "analyze_code" | "research" | "design";

/**
 * Build agent phases - recursive implementation loop
 */
export type BuildPhase = "implement" | "validate";

/**
 * Terminal states - workflow completion states
 */
export type TerminalState = "done" | "failed";

/**
 * Hierarchical state - represents the current state in the workflow
 *
 * Combines agent modes with their specific phases, or terminal states.
 */
export type HierarchicalState =
  | { mode: "plan"; phase: PlanPhase }
  | { mode: "build"; phase: BuildPhase }
  | TerminalState;

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Recent state entry for oscillation detection
 */
export interface RecentStateEntry {
  state: string;
  timestamp: number;
}

/**
 * XState machine context - shared state across the workflow
 *
 * Tracks messages, iteration state, error counts, and execution history
 * for doom loop detection and state management.
 */
export interface RLMMachineContext {
  /**
   * Message history from LLM interactions
   */
  messages: Array<Message>;

  /**
   * Original user goal/request
   */
  goal: string;

  /**
   * Current iteration count (for doom loop detection)
   */
  iterationCount: number;

  /**
   * Recent states for oscillation detection
   */
  recentStates: Array<RecentStateEntry>;

  /**
   * Last state (serialized as JSON string for XState compatibility)
   */
  lastState: string | null;

  /**
   * Tool execution count (for doom loop detection)
   */
  toolExecutionCount: number;

  /**
   * Error counts by tool name (for doom loop detection)
   */
  errorCounts: Record<string, number>;

  /**
   * Result from explore subagent (set during analyze_code phase)
   */
  spawnExploreAgentResult?: string;

  /**
   * Runtime controls for execution (test mode, cancellation).
   */
  runtime?: AgentRuntime;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * XState machine events - state transitions and external signals
 *
 * Events drive state transitions in the XState machine.
 */
export type RLMMachineEvent =
  | { type: "SPAWN_EXPLORE_COMPLETE"; result: string }
  | { type: "PLAN_AGENT_COMPLETE"; phase: PlanPhase; content: string }
  | { type: "BUILD_AGENT_COMPLETE"; phase: BuildPhase; content: string }
  | { type: "DOOM_LOOP_DETECTED" }
  | { type: "COMPLETE" }
  | { type: "FAIL"; error: string };

// ============================================================================
// LOOP CONTROL TYPES
// ============================================================================

/**
 * Loop control result - determines whether to continue looping
 */
export interface LoopControlResult {
  /**
   * Whether to continue the loop
   */
  shouldContinue: boolean;

  /**
   * Human-readable reason for the decision
   */
  reason?: string;
}

/**
 * Safety limits for each phase (doom loop protection only)
 *
 * These are backup limits - agents should naturally stop via finishReason.
 */
export const PHASE_SAFETY_LIMITS: Record<PlanPhase | BuildPhase, number> = {
  // Plan phases
  analyze_code: 5, // Small loop for planning before spawning explore
  research: 100, // Intent-based with large safety net
  design: 100, // Intent-based with large safety net

  // Build phases
  implement: 50, // Implementation loop
  validate: 100, // Recursive validation
} as const;
