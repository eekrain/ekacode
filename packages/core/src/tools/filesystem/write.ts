/**
 * Write file tool
 */

import { createLogger } from "@ekacode/shared/logger";
import { tool, zodSchema } from "ai";
import { createTwoFilesPatch } from "diff";
import fs from "node:fs/promises";
import path from "node:path";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { Instance } from "../../instance";
import { PermissionManager } from "../../security/permission-manager";
import { assertExternalDirectory } from "../base/filesystem";

const logger = createLogger("ekacode");

export const writeTool = tool({
  description: `Write content to a file.

- Creates parent directories automatically
- Shows unified diff before writing
- Requires permission for file modifications
- Overwrites existing files if they exist`,

  inputSchema: zodSchema(
    z.object({
      content: z.string().describe("Content to write to the file"),
      filePath: z.string().describe("Absolute path to the file"),
    })
  ),

  outputSchema: zodSchema(
    z.object({
      success: z.boolean(),
      filePath: z.string(),
      diff: z.string(),
      created: z.boolean(),
    })
  ),

  execute: async ({ content, filePath }, _options) => {
    // Get context from Instance instead of experimental_context
    const { directory, sessionID } = Instance.context;
    const permissionMgr = PermissionManager.getInstance();
    const toolLogger = logger.child({ module: "tool:write", tool: "write", sessionID });

    // Resolve path
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(directory, filePath);
    const relativePath = path.relative(directory, absolutePath);

    // Check external directory permission
    await assertExternalDirectory(absolutePath, directory, async (permission, patterns) => {
      return permissionMgr.requestApproval({
        id: uuidv7(),
        permission,
        patterns,
        always: [],
        sessionID,
      });
    });

    // Check if file exists
    const exists = await fs
      .access(absolutePath)
      .then(() => true)
      .catch(() => false);
    const oldContent = exists ? await fs.readFile(absolutePath, "utf-8") : "";

    // Generate diff
    const diff = createTwoFilesPatch(absolutePath, absolutePath, oldContent, content);

    toolLogger.debug("Requesting write permission", {
      path: relativePath,
      created: !exists,
    });

    // Check edit permission
    const editApproved = await permissionMgr.requestApproval({
      id: uuidv7(),
      permission: "edit",
      patterns: [relativePath],
      always: [],
      sessionID,
      metadata: { diff, filepath: absolutePath },
    });

    if (!editApproved) {
      toolLogger.warn("Write permission denied", {
        path: relativePath,
      });
      throw new Error(`Permission denied: Cannot write to ${filePath}`);
    }

    // Create parent directories
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    // Write file
    await fs.writeFile(absolutePath, content, "utf-8");

    toolLogger.info("File written successfully", {
      path: relativePath,
      created: !exists,
      size: content.length,
    });

    return {
      success: true,
      filePath: relativePath,
      diff,
      created: !exists,
    };
  },
});
