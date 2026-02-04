/**
 * List directory tool
 */

import { tool } from "ai";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PermissionManager } from "../../security/permission-manager";
import { getContextOrThrow } from "../base/context";
import { validatePathOperation } from "../base/safety";

/** Patterns to ignore when listing directories */
const IGNORE_PATTERNS = [
  "node_modules/**",
  "__pycache__/**",
  ".git/**",
  "dist/**",
  "build/**",
  "target/**",
  "vendor/**",
  "bin/**",
  "obj/**",
  ".idea/**",
  ".vscode/**",
  ".zig-cache/**",
  "zig-out/**",
  ".coverage/**",
  "coverage/**",
  "vendor/**",
  "tmp/**",
  "temp/**",
  ".cache/**",
  "cache/**",
  "logs/**",
  ".venv/**",
  "venv/**",
  "env/**",
];

/** Maximum files to list before truncating */
const MAX_FILES = 100;

/** Mini-match style glob to regex conversion (simplified) */
function globToRegex(glob: string): RegExp {
  const regexStr = glob.replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\./g, "\\.");
  return new RegExp(`^${regexStr}`);
}

/** Check if a path matches any ignore pattern */
function matchesIgnorePattern(relativePath: string): boolean {
  for (const pattern of IGNORE_PATTERNS) {
    const parts = pattern.split("/");
    const patternRegex = globToRegex(parts.join("/"));
    if (patternRegex.test(relativePath)) {
      return true;
    }
  }
  return false;
}

export const lsTool = tool({
  description: `List files and directories in a given path.

Returns a formatted directory tree showing the project structure. The path parameter is relative to the workspace root (use "." for current directory). Large directories will be truncated to ${MAX_FILES} files.

**Important**: You should generally prefer the glob or grep tools instead of calling ls repeatedly. Use ls ONCE per directory to understand the structure, then use glob/grep/read for specific exploration. Do NOT call ls multiple times on the same directory with different parameters - the first call shows you what you need.

**Usage guidelines:**
- Use this tool ONCE to get an overview of the project structure
- For finding specific files by pattern, use the glob tool
- For searching file contents, use the grep tool
- For reading file contents, use the read tool
- Each directory should only be listed once

**Example output:**
\`\`
/home/user/project/
  src/
    main.ts
    utils.ts
  package.json
  README.md
\`\``,

  inputSchema: z.object({
    dirPath: z
      .string()
      .describe(
        'Path to the directory (relative to workspace root, use "." for current directory)'
      ),
    recursive: z
      .boolean()
      .optional()
      .describe(
        "List recursively (default: false). **Use with caution** - may return many results"
      ),
  }),

  outputSchema: z.object({
    title: z.string().describe("Relative path from workspace root"),
    output: z.string().describe("Formatted directory tree"),
    metadata: z
      .object({
        count: z.number().describe("Total number of files/directories found"),
        truncated: z.boolean().describe("Whether results were truncated due to limit"),
      })
      .optional(),
  }),

  execute: async ({ dirPath, recursive = false }) => {
    // Get context with enhanced error message
    const { directory, sessionID } = getContextOrThrow();
    const permissionMgr = PermissionManager.getInstance();

    // Default to current directory if not specified
    const targetPath = dirPath || ".";

    // Validate path operation and get safe paths
    const { absolutePath, relativePath } = await validatePathOperation(
      targetPath,
      directory,
      "read",
      permissionMgr,
      sessionID,
      { always: ["*"] }
    );

    const files: Array<{ name: string; relPath: string; type: "file" | "directory" }> = [];

    async function traverse(currentPath: string, currentRelPath: string) {
      try {
        const items = await fs.readdir(currentPath, { withFileTypes: true });

        for (const item of items) {
          const itemRelPath = path.join(currentRelPath, item.name);

          // Skip ignored patterns
          if (matchesIgnorePattern(itemRelPath)) {
            continue;
          }

          // Limit total files
          if (files.length >= MAX_FILES) {
            return;
          }

          files.push({
            name: item.name,
            relPath: itemRelPath,
            type: item.isDirectory() ? "directory" : "file",
          });

          if (recursive && item.isDirectory() && !matchesIgnorePattern(itemRelPath)) {
            await traverse(path.join(currentPath, item.name), itemRelPath);
          }
        }
      } catch (error: unknown) {
        // Skip directories we can't read (e.g., permission denied)
        if (!(error instanceof Object && "code" in error && error.code === "ENOENT")) {
          // Log but don't fail - just skip the problematic directory
          // This allows the tool to continue with other directories
        }
      }
    }

    await traverse(absolutePath, relativePath === "." ? "" : relativePath);

    // Build tree structure
    function buildTree(fileList: typeof files): string {
      interface TreeNode {
        files: string[];
        dirs: Record<string, TreeNode>;
      }

      const root: TreeNode = { files: [], dirs: {} };

      for (const file of fileList) {
        const parts = file.relPath.split("/").filter(Boolean);

        let current: TreeNode = root;

        // Handle files at root level (no path parts)
        if (parts.length === 0) {
          if (file.type === "file") {
            current.files.push(file.name);
          }
          continue;
        }

        // Traverse/create directory nodes for all but the last part
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current.dirs[part]) {
            current.dirs[part] = { files: [], dirs: {} };
          }
          current = current.dirs[part];
        }

        // Handle the last part (file or directory)
        const lastPart = parts[parts.length - 1];
        if (file.type === "directory") {
          // Create directory node (may have files added later)
          if (!current.dirs[lastPart]) {
            current.dirs[lastPart] = { files: [], dirs: {} };
          }
          // Don't traverse into it - dir nodes are created but empty initially
        } else {
          // Add file to parent directory's files array
          current.files.push(lastPart);
        }
      }

      // Render tree
      function render(node: TreeNode, indent = 0): string {
        let output = "";
        const sortedKeys = Object.keys(node.dirs).sort();

        for (const key of sortedKeys) {
          const item = node.dirs[key];
          output += "  ".repeat(indent) + key + "/\n";

          // Render files in this directory
          for (const file of item.files.sort()) {
            output += "  ".repeat(indent + 1) + file + "\n";
          }

          // Render subdirectories recursively
          const subDirs = Object.keys(item.dirs).sort();
          for (const subKey of subDirs) {
            const subItem = item.dirs[subKey];
            output += "  ".repeat(indent + 1) + subKey + "/\n";

            // Render files in subdirectory
            for (const file of subItem.files.sort()) {
              output += "  ".repeat(indent + 2) + file + "\n";
            }

            // Recursively render nested subdirectories
            output += renderSubdirs(subItem, indent + 2);
          }
        }

        // Render root-level files
        for (const file of node.files.sort()) {
          output += "  ".repeat(indent) + file + "\n";
        }

        return output;
      }

      // Helper to recursively render nested directories
      function renderSubdirs(node: TreeNode, indent: number): string {
        let output = "";
        const subDirs = Object.keys(node.dirs).sort();
        for (const key of subDirs) {
          const item = node.dirs[key];
          output += "  ".repeat(indent) + key + "/\n";

          for (const file of item.files.sort()) {
            output += "  ".repeat(indent + 1) + file + "\n";
          }

          output += renderSubdirs(item, indent + 1);
        }
        return output;
      }

      return render(root);
    }

    const treeOutput = buildTree(files);

    // Add header with absolute path
    const header = `${relativePath === "." || !relativePath ? "." : relativePath}/\n`;
    const hint = recursive
      ? ""
      : "\n[Shown: top-level files and directories. Use glob/grep/read to explore specific files.]\n";

    const output = header + treeOutput + hint;

    return {
      title: relativePath === "." ? "." : relativePath,
      output,
      metadata: {
        count: files.length,
        truncated: files.length >= MAX_FILES,
      },
    };
  },
});
