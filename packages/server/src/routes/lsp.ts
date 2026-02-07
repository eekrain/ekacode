/**
 * LSP API Routes
 *
 * GET /api/lsp/status - Get LSP server status
 */

import { Hono } from "hono";
import type { Env } from "../index";

const lspRouter = new Hono<Env>();

/**
 * Get LSP server status
 */
lspRouter.get("/api/lsp/status", async c => {
  const directory = c.req.query("directory") || c.get("instanceContext")?.directory;

  // TODO: Implement actual LSP status checking
  return c.json({
    servers: [],
    directory,
  });
});

export default lspRouter;
