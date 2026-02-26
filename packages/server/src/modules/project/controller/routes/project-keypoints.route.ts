import { Hono } from "hono";
import type { Env } from "../../../../index.js";
import {
  createProjectKeypoint as createProjectKeypointUseCase,
  deleteProjectKeypoint as deleteProjectKeypointUseCase,
  listProjectKeypoints as listProjectKeypointsUseCase,
} from "../../application/usecases/project-keypoints.usecase.js";

const keypointsApp = new Hono<Env>();

function serializeKeypoint(
  keypoint: Awaited<ReturnType<typeof listProjectKeypointsUseCase>>[number]
) {
  return {
    id: keypoint.id,
    workspaceId: keypoint.workspaceId,
    taskSessionId: keypoint.taskSessionId,
    taskTitle: keypoint.taskTitle,
    milestone: keypoint.milestone,
    completedAt: keypoint.completedAt.toISOString(),
    summary: keypoint.summary,
    artifacts: keypoint.artifacts,
    createdAt: keypoint.createdAt.toISOString(),
  };
}

keypointsApp.get("/api/project-keypoints", async c => {
  const workspaceId = c.req.query("workspaceId");

  if (!workspaceId) {
    return c.json({ error: "workspaceId query parameter required" }, 400);
  }

  try {
    const keypoints = await listProjectKeypointsUseCase(workspaceId);
    return c.json({ keypoints: keypoints.map(serializeKeypoint) });
  } catch (error) {
    console.error("Failed to list project keypoints:", error);
    return c.json({ error: "Failed to list project keypoints" }, 500);
  }
});

keypointsApp.post("/api/project-keypoints", async c => {
  try {
    const body = await c.req.json();
    const { workspaceId, taskSessionId, taskTitle, milestone, summary, artifacts } = body;

    if (!workspaceId) {
      return c.json({ error: "workspaceId is required" }, 400);
    }
    if (!taskSessionId) {
      return c.json({ error: "taskSessionId is required" }, 400);
    }
    if (!taskTitle) {
      return c.json({ error: "taskTitle is required" }, 400);
    }
    if (!milestone || !["started", "completed"].includes(milestone)) {
      return c.json({ error: "milestone must be 'started' or 'completed'" }, 400);
    }
    if (!summary) {
      return c.json({ error: "summary is required" }, 400);
    }

    const keypoint = await createProjectKeypointUseCase({
      workspaceId,
      taskSessionId,
      taskTitle,
      milestone,
      summary,
      artifacts,
    });

    return c.json({ keypoint: serializeKeypoint(keypoint) }, 201);
  } catch (error) {
    console.error("Failed to create project keypoint:", error);
    return c.json({ error: "Failed to create project keypoint" }, 500);
  }
});

keypointsApp.delete("/api/project-keypoints/:id", async c => {
  const { id } = c.req.param();

  try {
    await deleteProjectKeypointUseCase(id);
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project keypoint:", error);
    return c.json({ error: "Failed to delete project keypoint" }, 500);
  }
});

export { keypointsApp };
