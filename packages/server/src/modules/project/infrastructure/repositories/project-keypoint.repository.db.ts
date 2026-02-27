import {
  createProjectKeypoint as dbCreateProjectKeypoint,
  deleteProjectKeypoint as dbDeleteProjectKeypoint,
  listProjectKeypointsByWorkspace as dbListProjectKeypointsByWorkspace,
} from "../../../../../db/project-keypoints.js";
import type {
  CreateProjectKeypointInput,
  IProjectKeypointRepository,
  ProjectKeypointRecord,
} from "../../domain/repositories/project-keypoint.repository.js";

export class DbProjectKeypointRepository implements IProjectKeypointRepository {
  async listByWorkspace(workspaceId: string): Promise<ProjectKeypointRecord[]> {
    const keypoints = await dbListProjectKeypointsByWorkspace(workspaceId);
    return keypoints.map(keypoint => ({
      id: keypoint.id,
      workspaceId: keypoint.workspaceId,
      taskSessionId: keypoint.taskSessionId,
      taskTitle: keypoint.taskTitle,
      milestone: keypoint.milestone,
      completedAt: keypoint.completedAt,
      summary: keypoint.summary,
      artifacts: keypoint.artifacts,
      createdAt: keypoint.createdAt,
    }));
  }

  async create(input: CreateProjectKeypointInput): Promise<ProjectKeypointRecord> {
    const keypoint = await dbCreateProjectKeypoint(input);
    return {
      id: keypoint.id,
      workspaceId: keypoint.workspaceId,
      taskSessionId: keypoint.taskSessionId,
      taskTitle: keypoint.taskTitle,
      milestone: keypoint.milestone,
      completedAt: keypoint.completedAt,
      summary: keypoint.summary,
      artifacts: keypoint.artifacts,
      createdAt: keypoint.createdAt,
    };
  }

  async delete(id: string): Promise<void> {
    await dbDeleteProjectKeypoint(id);
  }
}

export const projectKeypointRepository = new DbProjectKeypointRepository();
