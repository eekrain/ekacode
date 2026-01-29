/**
 * Health check endpoint
 *
 * Public endpoint for health monitoring.
 * No authentication required.
 * Returns server status, uptime, timestamp, and version.
 */

import { Hono } from "hono";
import type { HealthResponse } from "../types";

const app = new Hono();

/**
 * GET /api/health
 *
 * Returns health status information.
 * This endpoint should be quick and always return 200 when the server is running.
 */
function buildHealthResponse(): HealthResponse {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();

  return {
    status: "ok",
    uptime,
    timestamp,
    version: "0.0.1",
  };
}

app.get("/api/health", c => {
  return c.json(buildHealthResponse());
});

export default app;
