/**
 * Project detection utility
 *
 * Detects project identity from git remote origin or falls back to folder name.
 */

import { execSync } from "node:child_process";
import path from "node:path";

export interface ProjectIdentity {
  name: string;
  path: string;
}

export function parseGitRemoteUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim();

  const httpsMatch = trimmed.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  const githubSshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (githubSshMatch) {
    return { owner: githubSshMatch[1], repo: githubSshMatch[2] };
  }

  return null;
}

export function getFolderName(workspacePath: string): string {
  const normalized = workspacePath.replace(/[\/\\]+$/, "");
  const parts = normalized.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

export function detectProject(workspacePath: string): ProjectIdentity {
  const normalizedPath = path.normalize(workspacePath);

  let projectName: string;
  let projectPath: string;

  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: normalizedPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const parsed = parseGitRemoteUrl(remoteUrl);

    if (parsed) {
      projectName = `${parsed.owner}/${parsed.repo}`.toLowerCase();
      projectPath = `${parsed.owner}/${parsed.repo}`.toLowerCase();
    } else {
      const folderName = getFolderName(normalizedPath);
      projectName = folderName.toLowerCase();
      projectPath = folderName.toLowerCase();
    }
  } catch {
    const folderName = getFolderName(normalizedPath);
    projectName = folderName.toLowerCase();
    projectPath = folderName.toLowerCase();
  }

  return {
    name: projectName,
    path: projectPath,
  };
}

export function detectProjectSync(workspacePath: string): ProjectIdentity {
  return detectProject(workspacePath);
}
