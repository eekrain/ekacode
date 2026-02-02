/**
 * Coder Agent - AI SDK v6 tool-loop agent factory
 */

import type { ToolSet } from "ai";
import { createRoleAgent } from "./core/role-agent";
import type { AgentModels, RoleAgentOverrides } from "./core/types";

export const CODER_AGENT_INSTRUCTIONS = `You are an expert coding agent with filesystem access.

Best practices:
- Always read files before editing them
- Use write for new files, edit for modifications
- Use multiedit when making multiple related changes
- Check tool outputs for errors before proceeding
- Use glob to discover files, ls to explore directory structure`;

export function createCoderAgent<TOOLS extends ToolSet>(
  models: AgentModels,
  overrides: RoleAgentOverrides<TOOLS> = {}
) {
  return createRoleAgent<TOOLS>(
    {
      id: "coder-agent",
      name: "Coding Agent",
      instructions: CODER_AGENT_INSTRUCTIONS,
    },
    models,
    overrides
  );
}
