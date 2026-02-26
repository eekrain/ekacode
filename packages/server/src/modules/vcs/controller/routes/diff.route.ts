import { Hono } from "hono";
import type { Env } from "../../../../index.js";
import { parseLimitOffset } from "../../../../routes/_shared/pagination.js";

const diffRouter = new Hono<Env>();

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
