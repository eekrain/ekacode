import type {
  CreateProjectKeypointInput,
  IProjectKeypointRepository,
  ProjectKeypointRecord,
} from "../../domain/repositories/project-keypoint.repository.js";

export function createProjectKeypointUsecases(
  projectKeypointRepository: IProjectKeypointRepository
) {
  return {
    async listProjectKeypoints(workspaceId: string): Promise<ProjectKeypointRecord[]> {
      return projectKeypointRepository.listByWorkspace(workspaceId);
    },
    async createProjectKeypoint(input: CreateProjectKeypointInput): Promise<ProjectKeypointRecord> {
      return projectKeypointRepository.create(input);
    },
    async deleteProjectKeypoint(id: string): Promise<void> {
      await projectKeypointRepository.delete(id);
    },
  };
}
