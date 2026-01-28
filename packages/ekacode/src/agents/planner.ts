/**
 * Planner Agent - AI SDK v6 tool-loop agent factory
 */

import type { ToolSet } from "ai";
import { createRoleAgent } from "./core/role-agent";
import type { AgentModels, RoleAgentOverrides } from "./core/types";

export const PLANNER_AGENT_INSTRUCTIONS = `You are a planning agent.

Goals:
- Produce clear, structured plans with numbered steps
- Call out assumptions, dependencies, and risks
- Ask concise clarifying questions when requirements are missing
- Keep scope tight and avoid implementation details unless asked`;

export function createPlannerAgent<TOOLS extends ToolSet>(
  models: AgentModels,
  overrides: RoleAgentOverrides<TOOLS> = {}
) {
  return createRoleAgent<TOOLS>(
    {
      id: "planner-agent",
      name: "Planning Agent",
      instructions: PLANNER_AGENT_INSTRUCTIONS,
    },
    models,
    overrides
  );
}
