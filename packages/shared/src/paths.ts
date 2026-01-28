/**
 * @ekacode/shared
 *
 * App path resolution for ekacode.
 * - Self-contained app home for config/state/db/logs
 * - Repo cache lives under cache
 * - Dev mode uses repo-local ./.ekacode (Option A)
 */

import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type AppMode = "dev" | "prod";

export interface AppPathOptions {
  mode?: AppMode;
  cwd?: string;
  platform?: NodeJS.Platform;
  homedir?: string;
  env?: NodeJS.ProcessEnv;
  appName?: string;
  electron?: {
    userData?: string;
    cache?: string;
  };
}

export interface ResolvedAppPaths {
  mode: AppMode;
  home: string;
  config: string;
  state: string;
  db: string;
  logs: string;
  cache: string;
  repoCache: string;
  ekacodeDbPath: string;
  mastraDbPath: string;
  ekacodeDbUrl: string;
  mastraDbUrl: string;
}

function resolvePath(base: string, cwd: string): string {
  return path.isAbsolute(base) ? base : path.resolve(cwd, base);
}

function inferMode(env: NodeJS.ProcessEnv, mode?: AppMode): AppMode {
  if (mode) {
    return mode;
  }
  if (env.EKACODE_DEV === "1" || env.NODE_ENV === "development") {
    return "dev";
  }
  return "prod";
}

function getOsUserDataBase(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homedir: string
): string {
  if (platform === "win32") {
    return env.APPDATA ?? path.join(homedir, "AppData", "Roaming");
  }
  if (platform === "darwin") {
    return path.join(homedir, "Library", "Application Support");
  }
  return env.XDG_CONFIG_HOME ?? path.join(homedir, ".config");
}

function getOsCacheBase(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homedir: string
): string {
  if (platform === "win32") {
    return env.LOCALAPPDATA ?? path.join(homedir, "AppData", "Local");
  }
  if (platform === "darwin") {
    return path.join(homedir, "Library", "Caches");
  }
  return env.XDG_CACHE_HOME ?? path.join(homedir, ".cache");
}

function normalizeDbUrl(value: string | undefined, cwd: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) {
    // Non-file URL (e.g., libsql/https). Leave as-is.
    return value;
  }

  if (value.startsWith("file:")) {
    const pathPart = value.slice("file:".length);
    if (pathPart.startsWith("//")) {
      return value;
    }
    const resolved = resolvePath(pathPart, cwd);
    return pathToFileURL(resolved).href;
  }

  // Treat as filesystem path
  return pathToFileURL(resolvePath(value, cwd)).href;
}

function fileUrlForPath(filePath: string): string {
  return pathToFileURL(filePath).href;
}

/**
 * Resolve ekacode paths for config/state/db/logs/cache.
 */
export function resolveAppPaths(options: AppPathOptions = {}): ResolvedAppPaths {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const homedir = options.homedir ?? os.homedir();
  const appName = options.appName ?? "ekacode";

  const mode = inferMode(env, options.mode);

  const homeOverride = env.EKACODE_HOME;
  const userDataOverride = env.EKACODE_USER_DATA_DIR;
  const cacheOverride = env.EKACODE_CACHE_DIR;

  let home: string;
  if (homeOverride) {
    home = resolvePath(homeOverride, cwd);
  } else if (mode === "dev") {
    home = path.resolve(cwd, ".ekacode");
  } else if (userDataOverride) {
    home = resolvePath(userDataOverride, cwd);
  } else if (options.electron?.userData) {
    home = options.electron.userData;
  } else {
    home = path.join(getOsUserDataBase(platform, env, homedir), appName);
  }

  let cache: string;
  if (cacheOverride) {
    cache = resolvePath(cacheOverride, cwd);
  } else if (mode === "dev") {
    cache = path.join(home, "cache");
  } else if (options.electron?.cache) {
    cache = options.electron.cache;
  } else {
    cache = path.join(getOsCacheBase(platform, env, homedir), appName);
  }

  const config = path.join(home, "config");
  const state = path.join(home, "state");
  const db = path.join(home, "db");
  const logs = path.join(home, "logs");
  const repoCache = path.join(cache, "repos");

  const ekacodeDbPath = path.join(db, "ekacode.db");
  const mastraDbPath = path.join(db, "mastra.db");

  const ekacodeDbUrl =
    normalizeDbUrl(env.EKACODE_DB_URL ?? env.DATABASE_URL, cwd) ?? fileUrlForPath(ekacodeDbPath);
  const mastraDbUrl =
    normalizeDbUrl(env.EKACODE_MASTRA_DB_URL, cwd) ?? fileUrlForPath(mastraDbPath);

  return {
    mode,
    home,
    config,
    state,
    db,
    logs,
    cache,
    repoCache,
    ekacodeDbPath,
    mastraDbPath,
    ekacodeDbUrl,
    mastraDbUrl,
  };
}
