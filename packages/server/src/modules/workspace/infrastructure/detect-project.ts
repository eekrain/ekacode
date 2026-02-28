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

export function parseGitRemoteUrl(
  url: string
): { host: string; owner: string; repo: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const parsePathParts = (rawPath: string): { owner: string; repo: string } | null => {
    const cleanPath = rawPath.replace(/\.git$/, "").replace(/\/+$/, "");
    const segments = cleanPath.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const repo = segments[segments.length - 1];
    const owner = segments.slice(0, -1).join("/");
    if (!owner || !repo) return null;
    return { owner, repo };
  };

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsedUrl = new URL(trimmed);
      const parts = parsePathParts(parsedUrl.pathname);
      if (!parts) return null;
      return { host: parsedUrl.host.toLowerCase(), owner: parts.owner, repo: parts.repo };
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("ssh://")) {
    try {
      const parsedUrl = new URL(trimmed);
      const parts = parsePathParts(parsedUrl.pathname);
      if (!parts) return null;
      return { host: parsedUrl.host.toLowerCase(), owner: parts.owner, repo: parts.repo };
    } catch {
      return null;
    }
  }

  const sshMatch = trimmed.match(/^(?:[^@]+@)?([^:]+):(.+)$/);
  if (sshMatch) {
    const parts = parsePathParts(sshMatch[2]);
    if (!parts) return null;
    return { host: sshMatch[1].toLowerCase(), owner: parts.owner, repo: parts.repo };
  }

  return null;
}

export function getFolderName(workspacePath: string): string {
  const normalized = workspacePath.replace(/[\/\\]+$/, "");
  const parts = normalized.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

function normalizeWorkspacePath(workspacePath: string): string {
  return path.resolve(workspacePath).replace(/\\/g, "/").replace(/\/+$/, "");
}

export function detectProject(workspacePath: string): ProjectIdentity {
  const normalizedPath = normalizeWorkspacePath(workspacePath);
  const folderName = getFolderName(normalizedPath).toLowerCase();

  const fallback = {
    name: folderName,
    path: `local:${normalizedPath}`,
  };

  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: normalizedPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const parsed = parseGitRemoteUrl(remoteUrl);

    if (parsed) {
      return {
        name: `${parsed.owner}/${parsed.repo}`.toLowerCase(),
        path: `${parsed.host}/${parsed.owner}/${parsed.repo}`.toLowerCase(),
      };
    }

    return {
      name: folderName,
      path: `remote:${remoteUrl.toLowerCase()}`,
    };
  } catch {
    return fallback;
  }
}

export function detectProjectSync(workspacePath: string): ProjectIdentity {
  return detectProject(workspacePath);
}
