import { Hono } from "hono";
import type { Env } from "../../../../index.js";
import { sessionBridge } from "../../../../middleware/session-bridge.js";
import { getProjectInfo, listProjects } from "../../application/usecases/get-project.usecase.js";

const projectApp = new Hono<Env>();

projectApp.use("*", sessionBridge);

projectApp.get("/api/project", async c => {
  const queryDir = c.req.query("directory")?.trim();

  try {
    const projectInfo = await getProjectInfo(queryDir);
    return c.json(projectInfo);
  } catch (error) {
    if (error instanceof Error && error.message === "Directory parameter required") {
      return c.json({ error: "Directory parameter required" }, 400);
    }
    console.error("Failed to get project info:", error);
    return c.json({ error: "Failed to get project info" }, 500);
  }
});

projectApp.get("/api/projects", async c => {
  try {
    const result = await listProjects();
    return c.json(result);
  } catch (error) {
    console.error("Failed to list projects:", error);
    return c.json({ error: "Failed to list projects" }, 500);
  }
});

export { projectApp };
