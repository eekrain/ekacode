import type { Hono } from "hono";
import type { Env } from "../index.js";
import { healthRoutes } from "../modules/health/controller/routes/index.js";
import { projectRoutes } from "../modules/project/controller/routes/index.js";
import { providerRoutes } from "../modules/provider/controller/routes/index.js";
import { runEventsRoutes, taskRunsRoutes } from "../modules/task-runs/controller/routes/index.js";
import { taskSessionsRoutes } from "../modules/task-sessions/controller/routes/index.js";
import { workspaceRoutes } from "../modules/workspace/controller/routes/index.js";

export function registerRoutes(app: Hono<Env>): void {
  app.route("/", healthRoutes);
  app.route("/", taskSessionsRoutes);
  app.route("/", taskRunsRoutes);
  app.route("/", runEventsRoutes);
  app.route("/", providerRoutes);
  app.route("/", workspaceRoutes);
  app.route("/", projectRoutes);
}

export const migrationCheckpoint = {
  task: "Create route registrar",
  status: "implemented-minimally",
} as const;
