/**
 * Todo API Routes
 *
 * GET /api/chat/:sessionId/todo - Get action items for a session
 */

import { Hono } from "hono";
import type { Env } from "../index";

const todoRouter = new Hono<Env>();

/**
 * Get todo items for a session
 */
todoRouter.get("/api/chat/:sessionId/todo", async c => {
  const sessionId = c.req.param("sessionId");

  // TODO: Implement actual todo retrieval from session data
  // For now, return empty result
  return c.json({
    sessionID: sessionId,
    todos: [],
    hasMore: false,
  });
});

export default todoRouter;
