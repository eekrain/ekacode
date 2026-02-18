/**
 * Project API Routes
 *
 * GET /api/project - Get current project info
 * GET /api/projects - List all projects
 */

import { detectProjectFromPath } from "@ekacode/core/server";
import { Hono } from "hono";
import type { Env } from "../index";
import { resolveDirectory } from "./_shared/directory-resolver";

const projectRouter = new Hono<Env>();

/**
 * Get current project info for a directory
 */
projectRouter.get("/api/project", async c => {
  const directory = c.req.query("directory")?.trim();

  if (directory === "") {
    return c.json({ error: "Directory parameter required" }, 400);
  }

  const resolution = resolveDirectory(c, { allowFallbackCwd: true });

  if (!resolution.ok) {
    return c.json({ error: resolution.reason }, 400);
  }

  const project = await detectProjectFromPath(resolution.directory);

  return c.json({
    id: project.root,
    name: project.name,
    path: project.root,
    detectedBy: project.packageJson ? "packageJson" : "directory",
    packageJson: project.packageJson,
  });
});

/**
 * List all projects
 */
projectRouter.get("/api/projects", async c => {
  const cwd = process.cwd();

  const project = await detectProjectFromPath(cwd);

  return c.json({
    projects: [
      {
        id: project.root,
        name: project.name,
        path: project.root,
        source: "current",
        lastSeen: Date.now(),
      },
    ],
  });
});

export default projectRouter;
