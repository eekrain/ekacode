/**
 * Shared route utilities
 */

import type { Context } from "hono";
import type { Env } from "../../index";

export interface DirectoryResolutionResult {
  ok: true;
  directory: string;
}

export interface DirectoryResolutionError {
  ok: false;
  reason: string;
}

export type DirectoryResolution = DirectoryResolutionResult | DirectoryResolutionError;

/**
 * Resolve directory from request query, instance context, or fallback
 *
 * Precedence:
 * 1. Explicit query `directory` parameter
 * 2. `instanceContext.directory` from middleware
 * 3. process.cwd() if `allowFallbackCwd` is true
 *
 * @param c - Hono context
 * @param options - Resolution options
 * @returns Resolution result with directory or error
 */
export function resolveDirectory(
  c: Context<Env>,
  options: { allowFallbackCwd?: boolean } = {}
): DirectoryResolution {
  const queryDir = c.req.query("directory")?.trim();
  const contextDir = c.get("instanceContext")?.directory?.trim();

  const raw = queryDir || contextDir || (options.allowFallbackCwd ? process.cwd() : "");

  if (!raw) {
    return { ok: false, reason: "Directory parameter required" };
  }

  if (!raw.trim()) {
    return { ok: false, reason: "Invalid directory parameter" };
  }

  if (/\u0000/.test(raw)) {
    return { ok: false, reason: "Invalid directory parameter" };
  }

  return { ok: true, directory: raw };
}
