import type { Hono } from "hono";
import { logger as loggingMiddleware } from "hono/logger";
import type { Env } from "../index.js";
import { authMiddleware } from "../middleware/auth.js";
import { cacheMiddleware } from "../middleware/cache.js";
import { rateLimitMiddleware } from "../middleware/rate-limit.js";

export function composeMiddleware(app: Hono<Env>): void {
  // CORS
  app.use("*", async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    c.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Task-Session-ID, X-Workspace, X-Directory"
    );
    if (c.req.method === "OPTIONS") {
      return c.newResponse(null, 204);
    }
    return next();
  });

  // Request logging
  app.use("*", loggingMiddleware());

  // Rate limiting
  app.use("*", rateLimitMiddleware);

  // Cache
  app.use("*", cacheMiddleware);

  // Auth
  app.use("*", authMiddleware);
}

export const migrationCheckpoint = {
  task: "Create middleware composer",
  status: "implemented-minimally",
} as const;
