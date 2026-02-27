import type {
  ITaskRepository,
  ListTaskOptions,
  TaskRecord,
} from "../../domain/repositories/task.repository.js";

export function createListTasksBySessionUsecase(taskRepository: ITaskRepository) {
  return async function listTasksBySessionUsecase(sessionId: string): Promise<TaskRecord[]> {
    return taskRepository.listBySession(sessionId);
  };
}

export function createListTasksUsecase(taskRepository: ITaskRepository) {
  return async function listTasksUsecase(options?: ListTaskOptions): Promise<TaskRecord[]> {
    return taskRepository.list(options);
  };
}
