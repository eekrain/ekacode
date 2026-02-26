import {
  archiveWorkspace as dbArchiveWorkspace,
  createWorkspace as dbCreateWorkspace,
  deleteWorkspace as dbDeleteWorkspace,
  getWorkspaceById as dbGetWorkspaceById,
  getWorkspaceByPath as dbGetWorkspaceByPath,
  listWorkspaces as dbListWorkspaces,
  restoreWorkspace as dbRestoreWorkspace,
  touchWorkspace as dbTouchWorkspace,
  updateWorkspace as dbUpdateWorkspace,
} from "../../../../../db/workspaces.js";
import type {
  ArchiveWorkspaceInput,
  CreateWorkspaceInput,
  IWorkspaceRepository,
  ListWorkspaceOptions,
  UpdateWorkspaceInput,
  Workspace,
} from "../../domain/repositories/workspace.repository.js";

export class WorkspaceRepository implements IWorkspaceRepository {
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    return dbCreateWorkspace(input);
  }

  async getById(id: string): Promise<Workspace | null> {
    return dbGetWorkspaceById(id);
  }

  async getByPath(path: string): Promise<Workspace | null> {
    return dbGetWorkspaceByPath(path);
  }

  async list(options?: ListWorkspaceOptions): Promise<Workspace[]> {
    return dbListWorkspaces(options?.status);
  }

  async update(id: string, input: UpdateWorkspaceInput): Promise<void> {
    await dbUpdateWorkspace(id, input);
  }

  async archive(id: string, metadata?: ArchiveWorkspaceInput): Promise<void> {
    await dbArchiveWorkspace(id, metadata);
  }

  async restore(id: string): Promise<void> {
    await dbRestoreWorkspace(id);
  }

  async touch(id: string): Promise<void> {
    await dbTouchWorkspace(id);
  }

  async delete(id: string): Promise<void> {
    await dbDeleteWorkspace(id);
  }
}

export const workspaceRepository = new WorkspaceRepository();
