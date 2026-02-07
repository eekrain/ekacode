/**
 * Command API Routes
 *
 * GET /api/commands - List available commands
 */

import { Hono } from "hono";
import type { Env } from "../index";

const commandRouter = new Hono<Env>();

/**
 * List available commands
 */
commandRouter.get("/api/commands", async c => {
  // TODO: Implement actual command discovery
  // For now, return empty list
  return c.json({
    commands: [],
  });
});

export default commandRouter;
