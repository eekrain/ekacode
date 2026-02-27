import { taskStorage } from "@sakti-code/core/memory/task/storage";
import type {
  ITaskRepository,
  ListTaskOptions,
  TaskRecord,
} from "../../domain/repositories/task.repository.js";

function mapTask(task: {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "closed";
  priority: number;
  type: string;
  session_id: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  closed_at: Date | null;
  close_reason: string | null;
}): TaskRecord {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    type: task.type,
    sessionId: task.session_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    closedAt: task.closed_at,
    closeReason: task.close_reason,
  };
}

export class MemoryTaskRepository implements ITaskRepository {
  async listBySession(sessionId: string): Promise<TaskRecord[]> {
    const tasks = await taskStorage.listTasksBySession(sessionId);
    return tasks.map(mapTask);
  }

  async list(options?: ListTaskOptions): Promise<TaskRecord[]> {
    const tasks = await taskStorage.listTasks({
      status: options?.status,
      limit: options?.limit,
    });
    return tasks.map(mapTask);
  }
}

export const taskRepository = new MemoryTaskRepository();
