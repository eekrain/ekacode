/**
 * Project detection utilities
 *
 * Automatically detects project root, type, and metadata from any directory.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectInfo } from "../instance/context";

/**
 * Detect project information from a directory
 *
 * Searches upward from the given path to find project markers:
 * - .git directory
 * - package.json (Node.js)
 * - pyproject.toml (Python)
 * - Cargo.toml (Rust)
 * - go.mod (Go)
 *
 * @param startPath - Starting directory or file path
 * @returns Detected project information
 */
export async function detectProject(startPath: string): Promise<ProjectInfo> {
  const absolutePath = path.resolve(startPath);

  // Check if it's a file or directory
  let currentPath = absolutePath;
  try {
    const stats = await fs.stat(absolutePath);
    if (stats.isFile()) {
      currentPath = path.dirname(absolutePath);
    }
  } catch {
    // Path doesn't exist, use as-is
  }

  // Search upward for project markers
  const projectRoot = await findProjectRoot(currentPath);

  // Detect project name and metadata
  const name = await detectProjectName(projectRoot);
  const packageJson = await readPackageJson(projectRoot);

  return {
    name,
    root: projectRoot,
    packageJson,
  };
}

/**
 * Find project root by searching for marker files/directories
 *
 * Searches upward from the current directory until finding a project marker
 * or reaching the filesystem root.
 */
async function findProjectRoot(startPath: string): Promise<string> {
  const markers = [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"];

  let currentPath = startPath;

  while (currentPath !== path.dirname(currentPath)) {
    // Check for any marker
    for (const marker of markers) {
      const markerPath = path.join(currentPath, marker);
      try {
        const stats = await fs.stat(markerPath);
        if (stats.isDirectory() || stats.isFile()) {
          return currentPath;
        }
      } catch {
        // Marker doesn't exist, continue
      }
    }

    // Move up one directory
    currentPath = path.dirname(currentPath);
  }

  // No markers found, return the start directory as fallback
  return startPath;
}

/**
 * Detect project name from directory or package.json
 */
async function detectProjectName(rootPath: string): Promise<string> {
  // Try to read from package.json
  const packageJson = await readPackageJson(rootPath);
  if (packageJson?.name && typeof packageJson.name === "string") {
    return packageJson.name;
  }

  // Fallback to directory name
  return path.basename(rootPath);
}

/**
 * Read and parse package.json if it exists
 */
async function readPackageJson(rootPath: string): Promise<Record<string, unknown> | undefined> {
  const packageJsonPath = path.join(rootPath, "package.json");

  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Find project root from a nested file path
 *
 * @param filePath - Any file path within the project
 * @returns The detected project root directory
 */
export async function findProjectRootFromPath(filePath: string): Promise<string> {
  const project = await detectProject(filePath);
  return project.root;
}
