/**
 * Dynamic tool routing and phase-based tool filtering
 *
 * This module provides phase-specific tool configuration for the RLM workflow.
 * Each phase has access to different tool sets to prevent agents from using
 * inappropriate tools at the wrong time.
 */

import type { BuildPhase, PlanPhase } from "../types";

/**
 * Tool category configuration for each phase
 */
interface PhaseToolConfig {
  read: boolean;
  write: boolean;
  research: boolean;
  emergency_research: boolean;
  planning: boolean;
  validation: boolean;
}

/**
 * Tool availability matrix for each phase
 *
 * Key decisions:
 * - Plan phases: read + research + planning tools only
 * - Build phases: write + validation tools, emergency research available
 * - Analyze code: read-only exploration tools
 * - Validate: emergency research for when things go wrong
 */
export const PHASE_TOOLS: Record<PlanPhase | BuildPhase, PhaseToolConfig> = {
  // ==========================================================================
  // PLAN PHASES (Read, Research, Planning only - NO WRITE)
  // ==========================================================================
  analyze_code: {
    read: true,
    write: false,
    research: false,
    emergency_research: false,
    planning: true,
    validation: false,
  },
  research: {
    read: true,
    write: false,
    research: true,
    emergency_research: false,
    planning: true,
    validation: false,
  },
  design: {
    read: true,
    write: false,
    research: true,
    emergency_research: false,
    planning: true,
    validation: false,
  },

  // ==========================================================================
  // BUILD PHASES (Write + Validation, Emergency Research available)
  // ==========================================================================
  implement: {
    read: true,
    write: true,
    research: false,
    emergency_research: false,
    planning: true,
    validation: false,
  },
  validate: {
    read: true,
    write: false,
    research: false,
    emergency_research: true, // For when validation fails
    planning: false,
    validation: true,
  },
};

/**
 * Get tools available for a specific plan phase
 *
 * @param phase - The plan phase
 * @returns Array of available tools for the phase
 */
export function getPlanTools(phase: PlanPhase): string[] {
  const config = PHASE_TOOLS[phase];
  const tools: string[] = [];

  if (config.read) {
    tools.push("readFile", "grep", "glob", "listFiles", "astParse");
  }
  if (config.research) {
    tools.push("webSearch", "webFetch");
  }
  if (config.planning) {
    tools.push("sequentialThinking");
  }

  return tools;
}

/**
 * Get tools available for a specific build phase
 *
 * @param phase - The build phase
 * @returns Array of available tools for the phase
 */
export function getBuildTools(phase: BuildPhase): string[] {
  const config = PHASE_TOOLS[phase];
  const tools: string[] = [];

  if (config.read) {
    tools.push("readFile", "grep", "glob", "listFiles", "astParse");
  }
  if (config.write) {
    tools.push("writeFile", "editFile");
  }
  if (config.validation) {
    tools.push("runTests", "lint", "typecheck");
  }
  if (config.emergency_research) {
    tools.push("webSearch", "webFetch");
  }

  return tools;
}

/**
 * Get tools available for the explore subagent
 *
 * Explore agent uses cost-effective gpt-4o-mini for codebase
 * exploration with read-only tools.
 *
 * @returns Array of available tools for exploration
 */
export function getExploreTools(): string[] {
  return ["readFile", "grep", "glob", "listFiles", "astParse"];
}
