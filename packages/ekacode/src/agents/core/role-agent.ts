/**
 * Role agent factory for AI SDK v6 ToolLoopAgent.
 */

import type { ToolSet } from "ai";
import { ToolLoopAgent } from "ai";
import { buildAgentModel } from "./build-agent-model";
import type { AgentModels, AgentProfile, RoleAgentOverrides } from "./types";

export function createRoleAgent<TOOLS extends ToolSet>(
  profile: AgentProfile<TOOLS>,
  models: AgentModels,
  overrides: RoleAgentOverrides<TOOLS>
): ToolLoopAgent<never, TOOLS> {
  const model = buildAgentModel(models);
  const tools = mergeToolSets(profile.tools, overrides.tools);

  const {
    tools: _overrideTools,
    instructions: overrideInstructions,
    toolChoice,
    output,
    id,
    ...restOverrides
  } = overrides;

  return new ToolLoopAgent({
    id: id ?? profile.id,
    model,
    instructions: overrideInstructions ?? profile.instructions,
    tools,
    toolChoice: toolChoice ?? profile.toolChoice,
    output: output ?? profile.output,
    ...restOverrides,
  });
}

function mergeToolSets<TOOLS extends ToolSet>(base?: TOOLS, extra?: TOOLS): TOOLS {
  if (!base && !extra) {
    return {} as TOOLS;
  }

  return { ...(base ?? {}), ...(extra ?? {}) } as TOOLS;
}
