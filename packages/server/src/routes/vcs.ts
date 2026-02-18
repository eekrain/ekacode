/**
 * VCS API Routes
 *
 * GET /api/vcs - Get version control state (git)
 */

import { getVcsInfo } from "@ekacode/core/server";
import { Hono } from "hono";
import type { Env } from "../index";
import { resolveDirectory } from "./_shared/directory-resolver";

const vcsRouter = new Hono<Env>();

/**
 * Get VCS state
 */
vcsRouter.get("/api/vcs", async c => {
  const directory = c.req.query("directory")?.trim();

  if (directory === "") {
    return c.json({ error: "Directory parameter required" }, 400);
  }

  const resolution = resolveDirectory(c, { allowFallbackCwd: true });

  if (!resolution.ok) {
    return c.json({ error: resolution.reason }, 400);
  }

  const vcs = await getVcsInfo(resolution.directory);

  return c.json({
    directory: resolution.directory,
    type: vcs.type,
    branch: vcs.branch,
    commit: vcs.commit,
    dirty: false,
    ahead: undefined,
    behind: undefined,
    status: vcs.type === "none" ? "uninitialized" : "clean",
  });
});

export default vcsRouter;
