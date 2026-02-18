/**
 * Files API Routes
 *
 * GET /api/files/search - Search files in project index
 * GET /api/files/status - Get file watcher status
 * POST /api/files/watch - Start watching a directory
 * DELETE /api/files/watch - Stop watching a directory
 */

import { Hono } from "hono";
import { fileIndex } from "../services/file-index";
import { fileWatcher } from "../services/file-watcher";

const filesRouter = new Hono();

filesRouter.get("/api/files/search", async c => {
  const directory = c.req.query("directory");
  const query = c.req.query("query") || "";
  const rawLimit = c.req.query("limit");
  const normalizedLimit = rawLimit?.trim();
  const limit = normalizedLimit === undefined ? 20 : Number.parseInt(normalizedLimit, 10);

  if (!directory) {
    return c.json({ error: "directory parameter required" }, 400);
  }

  if (
    normalizedLimit !== undefined &&
    (!/^\d+$/.test(normalizedLimit) || !Number.isFinite(limit) || limit < 1 || limit > 1000)
  ) {
    return c.json({ error: "invalid limit parameter" }, 400);
  }

  // Lazily bootstrap file indexing on first search for this directory.
  // This ensures context search works after app restart without a separate watch call.
  if (!fileIndex.hasIndex(directory)) {
    try {
      await fileWatcher.watch(directory);
    } catch (error) {
      return c.json(
        {
          error: "Failed to initialize file index",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }

  const results = fileIndex.search(directory, query, limit);

  return c.json({
    files: results,
    query,
    directory,
    count: results.length,
  });
});

filesRouter.get("/api/files/status", async c => {
  const directory = c.req.query("directory");

  if (!directory) {
    return c.json({
      watchers: [],
    });
  }

  return c.json({
    directory,
    watching: fileWatcher.isWatching(directory),
    indexed: fileIndex.hasIndex(directory),
  });
});

filesRouter.post("/api/files/watch", async c => {
  const { directory } = await c.req.json().catch(() => ({}));

  if (!directory) {
    return c.json({ error: "directory required in body" }, 400);
  }

  try {
    await fileWatcher.watch(directory);
    return c.json({
      success: true,
      directory,
      message: "Now watching for file changes",
    });
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
  const { directory } = await c.req.json().catch(() => ({}));

  if (!directory) {
    return c.json({ error: "directory required in body" }, 400);
  }

  try {
    await fileWatcher.unwatch(directory);
    return c.json({
      success: true,
      directory,
      message: "Stopped watching",
    });
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
