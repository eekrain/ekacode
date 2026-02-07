/**
 * Agent API Routes
 *
 * GET /api/agents - List available agents
 */

import { Hono } from "hono";
import type { Env } from "../index";

const agentRouter = new Hono<Env>();

/**
 * List available agents
 */
agentRouter.get("/api/agents", async c => {
  // TODO: Implement actual agent discovery
  // For now, return standard agents
  return c.json({
    agents: [
      { id: "hybrid", name: "Hybrid Agent" },
      { id: "coder", name: "Coder Agent" },
      { id: "planner", name: "Planner Agent" },
    ],
  });
});

export default agentRouter;
