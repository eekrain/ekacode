import {
  getFileStatus,
  searchFiles,
  unwatchDirectory,
  watchDirectory,
} from "@/modules/files/application/usecases/search-files.usecase.js";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../../index.js";

const filesRouter = new Hono<Env>();

filesRouter.get("/api/files/search", async c => {
  const directory = c.req.query("directory");
  const query = c.req.query("query") || "";
  const rawLimit = c.req.query("limit");
  const normalizedLimit = rawLimit?.trim();

  if (!directory) {
    return c.json({ error: "directory parameter required" }, 400);
  }

  const limit = normalizedLimit === undefined ? 20 : Number.parseInt(normalizedLimit, 10);

  if (
    normalizedLimit !== undefined &&
    (!/^\d+$/.test(normalizedLimit) || !Number.isFinite(limit) || limit < 1 || limit > 1000)
  ) {
    return c.json({ error: "invalid limit parameter" }, 400);
  }

  try {
    const result = await searchFiles({ directory, query, limit });
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: "Failed to search files",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

filesRouter.get("/api/files/status", async c => {
  const directory = c.req.query("directory");

  if (!directory) {
    return c.json({
      watchers: [],
    });
  }

  const status = getFileStatus(directory);
  return c.json(status);
});

const WatchBodySchema = z.object({
  directory: z.string(),
});

filesRouter.post("/api/files/watch", async c => {
  try {
    const body = await c.req.json();
    const parsed = WatchBodySchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    const result = await watchDirectory(parsed.data);
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: "Failed to start watcher",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

filesRouter.delete("/api/files/watch", async c => {
  try {
    const body = await c.req.json();
    const parsed = WatchBodySchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.issues }, 400);
    }

    const result = await unwatchDirectory(parsed.data);
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: "Failed to stop watcher",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

export default filesRouter;
