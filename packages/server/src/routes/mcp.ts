/**
 * MCP API Routes
 *
 * GET /api/mcp/status - Get MCP server status
 */

import { Hono } from "hono";
import type { Env } from "../index";

const mcpRouter = new Hono<Env>();

/**
 * Get MCP server status
 */
mcpRouter.get("/api/mcp/status", async c => {
  const directory = c.req.query("directory") || c.get("instanceContext")?.directory;

  // TODO: Implement actual MCP status checking
  return c.json({
    servers: [],
    directory,
  });
});

export default mcpRouter;
