import { Instance } from "@sakti-code/core/server";
import { createLogger } from "@sakti-code/shared/logger";
import { Hono } from "hono";
import type { Env } from "../../../../index.js";
import { sessionBridge } from "../../../../middleware/session-bridge.js";

const workspaceApp = new Hono<Env>();
const logger = createLogger("server");

workspaceApp.use("*", sessionBridge);

workspaceApp.get("/api/workspace", async c => {
  const requestId = c.get("requestId");
  const session = c.get("session");

  try {
    const buildWorkspace = () => ({
      directory: Instance.directory,
      project: Instance.project,
      vcs: Instance.vcs,
      inContext: Instance.inContext,
      sessionId: session?.taskSessionId,
    });

    const workspace = Instance.inContext
      ? await (async () => {
          await Instance.bootstrap();
          return buildWorkspace();
        })()
      : await Instance.provide({
          directory: process.cwd(),
          sessionID: session?.taskSessionId,
          async fn() {
            await Instance.bootstrap();
            return buildWorkspace();
          },
        });

    logger.debug("Workspace info retrieved", {
      module: "workspace",
      requestId,
      directory: workspace.directory,
      projectName: workspace.project?.name,
      vcsType: workspace.vcs?.type,
    });

    return c.json(workspace);
  } catch (error) {
    logger.error("Failed to get workspace info", error instanceof Error ? error : undefined, {
      module: "workspace",
      requestId,
    });

    return c.json(
      {
        error: "Workspace context not available",
        inContext: false,
      },
      500
    );
  }
});

export { workspaceApp };
