import type {
  ITaskSessionRepository,
  TaskSession,
  TaskSessionKind,
} from "../../domain/repositories/task-session.repository.js";

export interface CreateTaskSessionInput {
  resourceId: string;
  workspaceId?: string;
  sessionKind?: TaskSessionKind;
}

export interface CreateTaskSessionOutput {
  taskSession: TaskSession;
}

export function createCreateTaskSessionUsecase(repository: ITaskSessionRepository) {
  return async function createTaskSessionUsecase(
    input: CreateTaskSessionInput
  ): Promise<CreateTaskSessionOutput> {
    const taskSession = await repository.create({
      resourceId: input.resourceId,
      workspaceId: input.workspaceId,
      sessionKind: input.sessionKind ?? "task",
    });

    return { taskSession };
  };
}
