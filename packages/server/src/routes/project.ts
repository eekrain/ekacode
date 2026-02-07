/**
 * Project API Routes
 *
 * GET /api/project - Get current project info
 * GET /api/projects - List all projects
 */

import { Hono } from "hono";
import type { Env } from "../index";

const projectRouter = new Hono<Env>();

/**
 * Get current project info for a directory
 */
projectRouter.get("/api/project", async c => {
  const directory = c.req.query("directory") || c.get("instanceContext")?.directory;

  if (!directory) {
    return c.json({ error: "Directory parameter required" }, 400);
  }

  // TODO: Implement actual project detection
  // For now, return a placeholder response
  return c.json({
    id: "project-default",
    name: "Project",
    path: directory,
  });
});

/**
 * List all projects
 */
projectRouter.get("/api/projects", async c => {
  // TODO: Implement actual project listing
  // For now, return empty list
  return c.json({
    projects: [],
  });
});

export default projectRouter;
