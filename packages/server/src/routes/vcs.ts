/**
 * VCS API Routes
 *
 * GET /api/vcs - Get version control state (git)
 */

import { Hono } from "hono";
import type { Env } from "../index";

const vcsRouter = new Hono<Env>();

/**
 * Get VCS state
 */
vcsRouter.get("/api/vcs", async c => {
  const directory = c.req.query("directory") || c.get("instanceContext")?.directory;

  // TODO: Implement actual VCS state checking
  // For now, return placeholder data
  return c.json({
    branch: undefined,
    commit: undefined,
    status: "unknown",
    directory,
  });
});

export default vcsRouter;
