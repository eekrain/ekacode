/**
 * Core agent types for AI SDK v6 agents.
 */

import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { LanguageModel, ToolLoopAgentSettings, ToolSet } from "ai";
import type { NormalizeImage, PromptRegistry, PromptRegistryLoader } from "../hybrid-agent/types";

export type AgentModels =
  | {
      model: LanguageModel;
    }
  | {
      textModel: LanguageModelV3;
      visionModel?: LanguageModelV3;
      modelId?: string;
      promptRegistry?: PromptRegistry;
      promptRegistryLoader?: PromptRegistryLoader;
      normalizeImage?: NormalizeImage;
    };

export interface AgentProfile<TOOLS extends ToolSet> {
  id: string;
  name: string;
  instructions: ToolLoopAgentSettings<never, TOOLS>["instructions"];
  tools?: TOOLS;
  toolChoice?: ToolLoopAgentSettings<never, TOOLS>["toolChoice"];
  output?: ToolLoopAgentSettings<never, TOOLS>["output"];
}

export type RoleAgentOverrides<TOOLS extends ToolSet> = Omit<
  ToolLoopAgentSettings<never, TOOLS>,
  "model" | "tools" | "instructions" | "id"
> & {
  id?: string;
  instructions?: ToolLoopAgentSettings<never, TOOLS>["instructions"];
  tools?: TOOLS;
  toolChoice?: ToolLoopAgentSettings<never, TOOLS>["toolChoice"];
  output?: ToolLoopAgentSettings<never, TOOLS>["output"];
};
