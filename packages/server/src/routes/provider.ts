/**
 * Provider API Routes
 *
 * GET /api/providers - List available LLM providers
 * GET /api/providers/auth - Get auth state for providers
 */

import { Hono } from "hono";
import type { Env } from "../index";

const providerRouter = new Hono<Env>();

/**
 * List available LLM providers
 */
providerRouter.get("/api/providers", async c => {
  // TODO: Implement actual provider listing from config
  // For now, return common providers
  return c.json({
    providers: [
      { id: "zai", name: "Z.ai" },
      { id: "openai", name: "OpenAI" },
      { id: "anthropic", name: "Anthropic" },
    ],
  });
});

/**
 * Get auth state for providers
 */
providerRouter.get("/api/providers/auth", async c => {
  // TODO: Implement actual auth state checking
  // For now, return empty auth state
  return c.json({});
});

export default providerRouter;
