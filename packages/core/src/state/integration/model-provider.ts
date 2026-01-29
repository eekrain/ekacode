/**
 * Model provider configuration for RLM workflow
 *
 * This module provides language model instances for each phase of the
 * RLM workflow using Z.ai models (primary) and OpenAI (fallback).
 *
 * Model assignments (mapped from new-integration.md spec to Z.ai equivalents):
 * - planModel: glm-4.7 (high-quality planning, equivalent to gpt-4o)
 * - buildModel: glm-4.7-flash (fast code generation, equivalent to claude-3.5-sonnet)
 * - exploreModel: glm-4.7-flashx (cost-effective exploration, equivalent to gpt-4o-mini)
 *
 * Environment variables:
 * - ZAI_API_KEY: Required for Z.ai models
 * - OPENAI_API_KEY: Optional, for OpenAI fallback
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { zai } from "@ekacode/zai";

// ============================================================================
// ZAI PROVIDER (Primary)
// ============================================================================

/**
 * Plan model - uses glm-4.7 for high-quality planning decisions
 *
 * Equivalent to gpt-4o in the spec - highest quality planning model.
 * Temperature 0.7 for balanced creativity and reliability.
 */
export const planModel: LanguageModelV3 = zai("glm-4.7");

/**
 * Build model - uses glm-4.7-flash for fast code generation
 *
 * Equivalent to claude-3.5-sonnet in the spec - optimized for code generation.
 * Temperature 0.3 for deterministic, consistent output.
 */
export const buildModel: LanguageModelV3 = zai("glm-4.7-flash");

/**
 * Explore model - uses glm-4.7-flashx for cost-effective exploration
 *
 * Equivalent to gpt-4o-mini in the spec - faster, more economical exploration.
 * Temperature 0.3 for consistent exploration results.
 */
export const exploreModel: LanguageModelV3 = zai("glm-4.7-flashx");

// ============================================================================
// OPENAI PROVIDER (Fallback)
// ============================================================================

/**
 * OpenAI provider instance for fallback models.
 * Only initialized if OPENAI_API_KEY is set.
 */
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

/**
 * Fallback plan model using OpenAI gpt-4o
 *
 * Use this if Z.ai is unavailable or for comparison testing.
 */
export const planModelOpenAI: LanguageModelV3 = openai("gpt-4o");

/**
 * Fallback explore model using OpenAI gpt-4o-mini
 *
 * Use this if Z.ai is unavailable or for cost optimization.
 */
export const exploreModelOpenAI: LanguageModelV3 = openai("gpt-4o-mini");

// ============================================================================
// MODEL SELECTION HELPERS
// ============================================================================

/**
 * Get the appropriate plan model based on environment.
 * Prioritizes Z.ai, falls back to OpenAI if configured.
 */
export function getPlanModel(): LanguageModelV3 {
  // Use Z.ai by default (requires ZAI_API_KEY)
  if (process.env.ZAI_API_KEY || process.env.ZAI_BASE_URL) {
    return planModel;
  }
  // Fall back to OpenAI if available
  if (process.env.OPENAI_API_KEY) {
    return planModelOpenAI;
  }
  // No provider available - will fail at runtime
  throw new Error(
    "No model provider available. Set ZAI_API_KEY or OPENAI_API_KEY environment variable."
  );
}

/**
 * Get the appropriate build model based on environment.
 * Currently only Z.ai is supported for build (optimal for code generation).
 */
export function getBuildModel(): LanguageModelV3 {
  // Build requires Z.ai for optimal performance
  if (process.env.ZAI_API_KEY || process.env.ZAI_BASE_URL) {
    return buildModel;
  }
  throw new Error("Build model requires Z.ai provider. Set ZAI_API_KEY environment variable.");
}

/**
 * Get the appropriate explore model based on environment.
 * Prioritizes Z.ai, falls back to OpenAI if configured.
 */
export function getExploreModel(): LanguageModelV3 {
  // Use Z.ai by default
  if (process.env.ZAI_API_KEY || process.env.ZAI_BASE_URL) {
    return exploreModel;
  }
  // Fall back to OpenAI if available
  if (process.env.OPENAI_API_KEY) {
    return exploreModelOpenAI;
  }
  throw new Error(
    "No model provider available. Set ZAI_API_KEY or OPENAI_API_KEY environment variable."
  );
}
