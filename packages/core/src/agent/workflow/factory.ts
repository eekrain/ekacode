/**
 * Agent factory functions
 *
 * Creates agent configurations for different phases of the workflow.
 */

import { getToolsForPhase } from "../../tools/phase-tools";
import { PHASE_ITERATION_LIMITS, PHASE_MODELS } from "./config";
import { PHASE_PROMPTS } from "./prompts";
import { AgentConfig, AgentInput, AgentResult, AgentType } from "./types";

// Re-export constants for testing
export { PHASE_ITERATION_LIMITS, PHASE_MODELS } from "./config";
export { PHASE_PROMPTS } from "./prompts";

/**
 * Create an agent configuration
 */
export function createAgent(
  type: AgentType,
  id: string,
  customConfig?: Partial<AgentConfig>
): AgentConfig {
  return {
    id,
    type,
    model: PHASE_MODELS[type],
    systemPrompt: PHASE_PROMPTS[type],
    tools: Object.values(getToolsForPhase(type)),
    maxIterations: PHASE_ITERATION_LIMITS[type],
    ...customConfig,
  };
}

/**
 * Create an explore agent
 */
export function createExploreAgent(index: number): AgentConfig {
  return createAgent("explore", `explore-${index}`);
}

/**
 * Create a plan agent
 */
export function createPlanAgent(): AgentConfig {
  return createAgent("plan", "planner");
}

/**
 * Create a build agent
 */
export function createBuildAgent(): AgentConfig {
  return createAgent("build", "builder");
}

import { AgentProcessor } from "../../session/processor";

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
