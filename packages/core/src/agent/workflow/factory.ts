/**
 * Agent factory functions
 *
 * Creates agent configurations and executes agents using the
 * centralized agent registry.
 *
 * This module provides backward compatibility with the old phase-based
 * API while internally using the new registry system.
 */

import { AgentProcessor } from "../../session/processor";
import { getAgent as getAgentFromRegistry, loadModel, resolveTools } from "../registry";
import { AgentConfig, AgentInput, AgentResult, AgentType } from "./types";

// ============================================================================
// LEGACY CONSTANTS: Re-exported for backward compatibility
// ============================================================================

/** Phase iteration limits - backward compatibility */
export const PHASE_ITERATION_LIMITS = {
  explore: 30,
  plan: 100,
  build: 50,
} as const;

/** Phase models - backward compatibility */
export const PHASE_MODELS = {
  explore: "glm-4.7-flashx",
  plan: "glm-4.7",
  build: "glm-4.7",
} as const;

// ============================================================================
// LEGACY API: Phase-based agent creation (for backward compatibility)
// ============================================================================

// Re-export types and constants for backward compatibility
export { AgentType } from "./types";

/**
 * Create an agent configuration from registry
 *
 * This is the new unified API that looks up agents by name
 * from the centralized registry.
 *
 * @param name - Agent name (e.g., "build", "explore", "plan")
 * @param id - Unique identifier for this agent instance
 * @param customConfig - Optional overrides for agent configuration
 * @returns Complete agent configuration
 */
export function createAgent(
  name: string,
  id: string,
  customConfig?: Partial<Omit<AgentConfig, "id" | "type">>
): AgentConfig {
  const registryConfig = getAgentFromRegistry(name);

  // Resolve tool names to actual tool implementations
  const tools = resolveTools(registryConfig.tools);

  // Load the language model
  loadModel(registryConfig.model);

  return {
    id,
    type: registryConfig.name as AgentType, // Map name to AgentType for compatibility
    model: registryConfig.model,
    systemPrompt: registryConfig.systemPrompt,
    tools: tools, // Pass tools as object with named keys, not as array
    maxIterations: registryConfig.maxIterations,
    temperature: registryConfig.temperature,
    ...customConfig,
  };
}

/**
 * Create an explore agent
 *
 * @param index - Index for unique agent ID
 * @returns Agent configuration for explore agent
 */
export function createExploreAgent(index: number): AgentConfig {
  return createAgent("explore", `explore-${index}`);
}

/**
 * Create a plan agent
 *
 * @returns Agent configuration for plan agent
 */
export function createPlanAgent(): AgentConfig {
  return createAgent("plan", "planner");
}

/**
 * Create a build agent
 *
 * @returns Agent configuration for build agent
 */
export function createBuildAgent(): AgentConfig {
  return createAgent("build", "builder");
}

/**
 * Run an agent with the given configuration and input
 *
 * Creates an AgentProcessor and executes the agent loop.
 *
 * @param config - Agent configuration
 * @param input - Agent input with task and context
 * @param onEvent - Callback for agent events (streaming)
 * @returns AgentResult with execution results
 */
export async function runAgent(
  config: AgentConfig,
  input: AgentInput,
  onEvent: (event: unknown) => void
): Promise<AgentResult> {
  const processor = new AgentProcessor(
    config,
    onEvent as (event: import("./types").AgentEvent) => void
  );
  return processor.run(input);
}
