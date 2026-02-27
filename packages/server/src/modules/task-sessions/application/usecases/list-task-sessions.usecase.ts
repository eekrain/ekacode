import type {
  ITaskSessionRepository,
  TaskSession,
  TaskSessionKind,
} from "../../domain/repositories/task-session.repository.js";

export interface ListTaskSessionsInput {
  workspaceId?: string;
  kind?: TaskSessionKind;
}

export interface ListTaskSessionsOutput {
  taskSessions: TaskSession[];
}

export function createListTaskSessionsUsecase(repository: ITaskSessionRepository) {
  return async function listTaskSessionsUsecase(
    input: ListTaskSessionsInput
  ): Promise<ListTaskSessionsOutput> {
    const sessions = await repository.list({
      workspaceId: input.workspaceId,
      kind: input.kind,
    });

    return { taskSessions: sessions };
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
