import { Hono } from "hono";
import type { Env } from "../../../../index.js";
import sessionDataRoutes from "../../../../routes/session-data.js";

const app = new Hono<Env>();

app.route("/", sessionDataRoutes);

export { app as sessionDataRoutes };

export const migrationCheckpoint = {
  task: "Create session data route module",
  status: "implemented-minimally",
} as const;
