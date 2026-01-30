/**
 * Tool registry for agent registration
 */

import {
  applyPatchTool,
  editTool,
  globTool,
  lsTool,
  multieditTool,
  readTool,
  writeTool,
} from "./index";
import { grepTool } from "./search/grep.tool";
import { webfetchTool } from "./search/webfetch.tool";
import { sequentialThinking } from "./sequential-thinking";
import { bashTool } from "./shell/bash.tool";

// Code research tools (search-docs)
import { astQuery, fileRead, grepSearch, searchDocs } from "./search-docs";

// Tool name type (union of all available tool names)
export type ToolName =
  | "read"
  | "write"
  | "edit"
  | "multiedit"
  | "apply_patch"
  | "ls"
  | "glob"
  | "bash"
  | "grep"
  | "webfetch"
  | "sequentialthinking"
  | "search-docs"
  | "ast-query"
  | "grep-search"
  | "file-read-docs";

export const toolRegistry = {
  // Filesystem tools
  read: readTool,
  write: writeTool,
  edit: editTool,
  multiedit: multieditTool,
  apply_patch: applyPatchTool,
  ls: lsTool,
  glob: globTool,

  // Shell tools
  bash: bashTool,

  // Search tools
  grep: grepTool,
  webfetch: webfetchTool,

  // AI Agent tools
  sequentialthinking: sequentialThinking,

  // Code research tools (search-docs)
  "search-docs": searchDocs,
  "ast-query": astQuery,
  "grep-search": grepSearch,
  "file-read-docs": fileRead, // Use distinct name to avoid conflict with filesystem read

  getAll(): Record<string, unknown> {
    const { getAll: _getAll, getToolNames: _getToolNames, ...tools } = this;
    return tools as Record<string, unknown>;
  },

  getToolNames(): string[] {
    return Object.keys(this);
  },
};

/**
 * Create a tools object with specified tools
 *
 * @param toolNames - Array of tool names to include
 * @returns Object containing only the specified tools
 */
export function createTools(toolNames: ToolName[]): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  for (const name of toolNames) {
    if (name in toolRegistry) {
      tools[name] = toolRegistry[name as keyof typeof toolRegistry];
    }
  }
  return tools;
}

/**
 * Get default tools for general coding tasks
 *
 * @returns Object containing commonly used tools
 */
export function getDefaultTools(): Record<string, unknown> {
  return createTools(["read", "write", "edit", "bash", "glob", "grep"]);
}

// Also export as TOOL_REGISTRY for consistency
export const TOOL_REGISTRY = toolRegistry;
