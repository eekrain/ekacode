export type TaskStatus = "open" | "in_progress" | "closed";

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  type: string;
  sessionId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  closedAt: Date | null;
  closeReason: string | null;
}

export interface ListTaskOptions {
  status?: TaskStatus;
  limit?: number;
}

export interface ITaskRepository {
  listBySession(sessionId: string): Promise<TaskRecord[]>;
  list(options?: ListTaskOptions): Promise<TaskRecord[]>;
}
