/**
 * Diff API Routes
 *
 * GET /api/chat/:sessionId/diff - Get file changes for a session
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { parseLimitOffset } from "./_shared/pagination";

const diffRouter = new Hono<Env>();

/**
 * Get file diffs for a session
 */
diffRouter.get("/api/chat/:sessionId/diff", async c => {
  const sessionId = c.req.param("sessionId");

  if (!sessionId) {
    return c.json({ error: "Session ID required" }, 400);
  }

  const pagination = parseLimitOffset(c.req.query());

  if (!pagination.ok) {
    return c.json({ error: pagination.reason }, 400);
  }

  return c.json({
    sessionID: sessionId,
    diffs: [],
    hasMore: false,
    total: 0,
  });
});

export default diffRouter;
