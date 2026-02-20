/**
 * @ekacode/shared
 *
 * App path resolution for sakti.
 * Simple: always use $HOME/.sakti for all data
 */

import os from "os";
import path from "path";
import { pathToFileURL } from "url";

export interface ResolvedAppPaths {
  home: string;
  config: string;
  state: string;
  db: string;
  logs: string;
  workspaces: string;
  sakticodeDbPath: string;
  sakticodeDbUrl: string;
}

function fileUrlForPath(filePath: string): string {
  return pathToFileURL(filePath).href;
}

/**
 * Resolve sakti paths.
 * Always uses $HOME/.sakti as base directory.
 */
export function resolveAppPaths(): ResolvedAppPaths {
  const homedir = os.homedir();
  const home = path.join(homedir, ".sakti");

  const config = path.join(home, "config");
  const state = path.join(home, "state");
  const db = path.join(home, "db");
  const logs = path.join(home, "logs");
  const workspaces = path.join(home, "workspaces");

  const sakticodeDbPath = path.join(db, "sakticode.db");
  const sakticodeDbUrl = fileUrlForPath(sakticodeDbPath);

  return {
    home,
    config,
    state,
    db,
    logs,
    workspaces,
    sakticodeDbPath,
    sakticodeDbUrl,
  };
}
