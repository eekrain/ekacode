/**
 * Agent model builder.
 *
 * Creates a hybrid model when a vision model is provided; otherwise returns the text model.
 */

import type { LanguageModel } from "ai";
import { HybridAgent, createDefaultPromptRegistry } from "../hybrid-agent";
import type { AgentModels } from "./types";

export function buildAgentModel(models: AgentModels): LanguageModel {
  if ("model" in models) {
    return models.model;
  }

  const { textModel, visionModel, modelId, promptRegistry, promptRegistryLoader, normalizeImage } =
    models;

  if (!visionModel) {
    return textModel;
  }

  const loadPrompts =
    promptRegistryLoader ?? (() => promptRegistry ?? createDefaultPromptRegistry());

  return new HybridAgent({
    modelId: modelId ?? "hybrid",
    textModel,
    visionModel,
    loadPrompts,
    normalizeImage,
  });
}
