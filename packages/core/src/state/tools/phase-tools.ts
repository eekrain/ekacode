/**
 * Phase-specific tool maps
 *
 * This module provides tool objects for each phase by importing
 * from the existing tool registry and filtering based on phase
 * requirements.
 */

import { toolRegistry } from "../../tools/registry";

/**
 * Get tools available for the explore subagent
 *
 * Explore agent uses read-only tools for codebase exploration.
 *
 * @returns Tool map for exploration
 */
export function getExploreToolMap(): Record<string, unknown> {
  const tools: Record<string, unknown> = {
    read: toolRegistry.read,
    grep: toolRegistry.grep,
    glob: toolRegistry.glob,
    ls: toolRegistry.ls,
    "ast-query": toolRegistry["ast-query"],
  };
  return tools;
}

/**
 * Get tools available for analyze_code phase
 *
 * Plan phase: read + AST analysis tools for code understanding.
 *
 * @returns Tool map for analyze_code phase
 */
export function getAnalyzeCodeToolMap(): Record<string, unknown> {
  const tools: Record<string, unknown> = {
    read: toolRegistry.read,
    grep: toolRegistry.grep,
    glob: toolRegistry.glob,
    ls: toolRegistry.ls,
    "ast-query": toolRegistry["ast-query"],
  };
  return tools;
}

/**
 * Get tools available for research phase
 *
 * Plan phase: read + research tools for external documentation lookup.
 *
 * @returns Tool map for research phase
 */
export function getResearchToolMap(): Record<string, unknown> {
  const tools: Record<string, unknown> = {
    read: toolRegistry.read,
    grep: toolRegistry.grep,
    glob: toolRegistry.glob,
    ls: toolRegistry.ls,
    // Code research tools
    "search-docs": toolRegistry["search-docs"],
    "ast-query": toolRegistry["ast-query"],
    "grep-search": toolRegistry["grep-search"],
    "file-read-docs": toolRegistry["file-read-docs"],
    // Multi-turn reasoning
    sequentialthinking: toolRegistry["sequentialthinking"],
  };
  return tools;
}

/**
 * Get tools available for design phase
 *
 * Plan phase: read + sequential thinking for complex planning.
 *
 * @returns Tool map for design phase
 */
export function getDesignToolMap(): Record<string, unknown> {
  const tools: Record<string, unknown> = {
    read: toolRegistry.read,
    grep: toolRegistry.grep,
    glob: toolRegistry.glob,
    ls: toolRegistry.ls,
    "ast-query": toolRegistry["ast-query"],
    sequentialthinking: toolRegistry["sequentialthinking"],
  };
  return tools;
}

/**
 * Get tools available for implement phase
 *
 * Build phase: write + read tools for code generation.
 *
 * @returns Tool map for implement phase
 */
export function getImplementToolMap(): Record<string, unknown> {
  return {
    read: toolRegistry.read,
    write: toolRegistry.write,
    edit: toolRegistry.edit,
    multiedit: toolRegistry.multiedit,
    glob: toolRegistry.glob,
    grep: toolRegistry.grep,
    ls: toolRegistry.ls,
    bash: toolRegistry.bash,
  };
}

/**
 * Get tools available for validate phase
 *
 * Build phase: read + validation tools, emergency research available.
 *
 * @returns Tool map for validate phase
 */
export function getValidateToolMap(): Record<string, unknown> {
  const tools: Record<string, unknown> = {
    read: toolRegistry.read,
    grep: toolRegistry.grep,
    glob: toolRegistry.glob,
    ls: toolRegistry.ls,
    bash: toolRegistry.bash,
  };
  // Add astParse when available in registry (TODO: implement astParse tool)
  // if ("astParse" in toolRegistry) {
  //   tools.astParse = toolRegistry.astParse;
  // }
  return tools;
}
