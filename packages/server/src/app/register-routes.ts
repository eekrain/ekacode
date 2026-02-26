import type { Hono } from "hono";
import type { Env } from "../index.js";

export function registerRoutes(_app: Hono<Env>): void {
  // Routes will be registered here as modules are migrated
  // This file serves as the central route registration point
}

export const migrationCheckpoint = {
  task: "Create route registrar",
  status: "implemented-minimally",
} as const;
