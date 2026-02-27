import type {
  ITaskSessionRepository,
  TaskSession,
  TaskSessionKind,
  TaskSessionStatus,
  TaskSpecType,
} from "../../domain/repositories/task-session.repository.js";

export interface UpdateTaskSessionInput {
  status?: TaskSessionStatus;
  specType?: TaskSpecType;
  title?: string;
}

export interface UpdateTaskSessionOutput {
  taskSession: TaskSession;
}

export function createUpdateTaskSessionUsecase(repository: ITaskSessionRepository) {
  return async function updateTaskSessionUsecase(
    taskSessionId: string,
    input: UpdateTaskSessionInput
  ): Promise<UpdateTaskSessionOutput> {
    await repository.update(taskSessionId, input);

    const taskSession = await repository.getById(taskSessionId);
    if (!taskSession) {
      throw new Error("Task session not found");
    }

    return { taskSession };
  };
}

export function createGetTaskSessionUsecase(repository: ITaskSessionRepository) {
  return async function getTaskSessionUsecase(taskSessionId: string): Promise<TaskSession | null> {
    return repository.getById(taskSessionId);
  };
}

export function createDeleteTaskSessionUsecase(repository: ITaskSessionRepository) {
  return async function deleteTaskSessionUsecase(taskSessionId: string): Promise<void> {
    return repository.delete(taskSessionId);
  };
}

export function createGetLatestTaskSessionByWorkspaceUsecase(repository: ITaskSessionRepository) {
  return async function getLatestTaskSessionByWorkspaceUsecase(
    workspaceId: string,
    kind: TaskSessionKind
  ): Promise<TaskSession | null> {
    return repository.getLatestByWorkspace(workspaceId, kind);
  };
}
