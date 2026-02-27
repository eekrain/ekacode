export interface ProjectKeypointRecord {
  id: string;
  workspaceId: string;
  taskSessionId: string;
  taskTitle: string;
  milestone: "started" | "completed";
  completedAt: Date;
  summary: string;
  artifacts: string[];
  createdAt: Date;
}

export interface CreateProjectKeypointInput {
  workspaceId: string;
  taskSessionId: string;
  taskTitle: string;
  milestone: "started" | "completed";
  summary: string;
  artifacts?: string[];
}

export interface IProjectKeypointRepository {
  listByWorkspace(workspaceId: string): Promise<ProjectKeypointRecord[]>;
  create(input: CreateProjectKeypointInput): Promise<ProjectKeypointRecord>;
  delete(id: string): Promise<void>;
}
