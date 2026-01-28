/**
 * @ekacode/core
 *
 * Core ekacode package - Mastra agents, tools, and utilities
 */

// Mastra instance
export { mastra, memory } from "./memory/mastra";

// Memory
export { EkacodeMemory, getMemory } from "./memory";

// Agents
export { buildAgentModel, createRoleAgent } from "./agents";
export type { AgentModels, AgentProfile, RoleAgentOverrides } from "./agents";
export { createCoderAgent } from "./agents/coder";
export { createPlannerAgent } from "./agents/planner";

// Tools
export {
  applyPatchTool,
  editTool,
  globTool,
  lsTool,
  multieditTool,
  readTool,
  writeTool,
} from "./tools";
export { toolRegistry } from "./tools/registry";

// Re-export base utilities
export {
  assertExternalDirectory,
  containsPath,
  detectBinaryFile,
  normalizePath,
} from "./tools/base/filesystem";
export { truncateOutput } from "./tools/base/truncation";
export { TRUNCATION_LIMITS } from "./tools/base/types";
export type { ToolExecutionContext, TruncationResult } from "./tools/base/types";

// Security
export type { PermissionAction, PermissionRule, PermissionType } from "@ekacode/shared";
export {
  PermissionDeniedError,
  PermissionManager,
  PermissionRejectedError,
  PermissionTimeoutError,
} from "./security/permission-manager";
export {
  createDefaultRules,
  evaluatePatterns,
  evaluatePermission,
  expandPath,
  findMatchingRule,
  formatConfigRules,
  globToRegex,
  matchesGlob,
  parseConfigRules,
  type PermissionConfig,
} from "./security/permission-rules";

// Workspace
export { WorkspaceInstance } from "./workspace/instance";

// Config
export { initializePermissionRules, loadPermissionConfig } from "./config/permissions";

// Hybrid Agent
export {
  HybridAgent,
  buildMcpPromptRegistry,
  createDefaultPromptRegistry,
  createPromptRegistry,
  createZaiHybridAgent,
} from "./agents/hybrid-agent";
export type {
  HybridAgentOptions,
  Intent,
  IntentId,
  PromptHandler,
  PromptRegistry,
  VisionImage,
  VisionRequest,
} from "./agents/hybrid-agent";

export const ekacodeVersion = "0.0.1";
