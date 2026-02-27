import { createProjectKeypointUsecases } from "../../application/usecases/project-keypoints.usecase.js";
import { projectKeypointRepository } from "../../infrastructure/repositories/project-keypoint.repository.db.js";

export function buildProjectKeypointUsecases() {
  return createProjectKeypointUsecases(projectKeypointRepository);
}
