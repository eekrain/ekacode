import type { Context } from "hono";
import type { Env } from "../index.js";

export type AppContext = Context<Env>;

export type AppVariables = Env["Variables"];

export const migrationCheckpoint = {
  task: "Create typed app context",
  status: "implemented-minimally",
} as const;
