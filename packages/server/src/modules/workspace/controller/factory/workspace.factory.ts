import { createWorkspaceUsecases } from "../../application/usecases/list-workspaces.usecase.js";
import { workspaceRepository } from "../../infrastructure/repositories/workspace.repository.drizzle.js";

export function buildWorkspaceUsecases() {
  return createWorkspaceUsecases(workspaceRepository);
}
