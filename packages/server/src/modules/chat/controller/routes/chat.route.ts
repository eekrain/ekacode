import { Hono } from "hono";
import type { Env } from "../../../../index.js";
import chatRoutes from "../../../../routes/chat.js";

const app = new Hono<Env>();

app.route("/", chatRoutes);

export { app as chatRoutes };

export const migrationCheckpoint = {
  task: "Create chat controller route",
  status: "implemented-minimally",
} as const;
