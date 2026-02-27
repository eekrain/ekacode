import type {
  IWorkspaceRepository,
  ListWorkspaceOptions,
  Workspace,
} from "../../domain/repositories/workspace.repository.js";

export interface CreateWorkspaceInput {
  path: string;
  name?: string;
}

export interface CreateWorkspaceResult {
  workspace: Workspace;
  existing: boolean;
}

export interface UpdateWorkspaceInput {
  name?: string;
}

export interface ArchiveWorkspaceInput {
  baseBranch?: string;
  repoPath?: string;
  isMerged?: boolean;
}

export function createWorkspaceUsecases(workspaceRepository: IWorkspaceRepository) {
  return {
    async listWorkspaces(options?: ListWorkspaceOptions): Promise<Workspace[]> {
      return workspaceRepository.list(options);
    },
    async getWorkspaceById(id: string): Promise<Workspace | null> {
      return workspaceRepository.getById(id);
    },
    async getWorkspaceByPath(path: string): Promise<Workspace | null> {
      return workspaceRepository.getByPath(path);
    },
    async createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult> {
      const existing = await workspaceRepository.getByPath(input.path);
      if (existing) {
        return { workspace: existing, existing: true };
      }

      const workspace = await workspaceRepository.create(input);
      return { workspace, existing: false };
    },
    async updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace | null> {
      await workspaceRepository.update(id, input);
      return workspaceRepository.getById(id);
    },
    async archiveWorkspace(
      id: string,
      metadata?: ArchiveWorkspaceInput
    ): Promise<Workspace | null> {
      await workspaceRepository.archive(id, metadata);
      return workspaceRepository.getById(id);
    },
    async restoreWorkspace(id: string): Promise<Workspace | null> {
      await workspaceRepository.restore(id);
      return workspaceRepository.getById(id);
    },
    async touchWorkspace(id: string): Promise<Workspace | null> {
      await workspaceRepository.touch(id);
      return workspaceRepository.getById(id);
    },
    async deleteWorkspace(id: string): Promise<void> {
      await workspaceRepository.delete(id);
    },
  };
}
