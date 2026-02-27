import type { ITaskRunEventRepository } from "../../domain/repositories/task-run-event.repository.js";
import type {
  ITaskRunRepository,
  TaskSessionRun,
} from "../../domain/repositories/task-run.repository.js";

export interface CancelTaskRunInput {
  runId: string;
}

export interface CancelTaskRunOutput {
  run: TaskSessionRun;
}

export function createCancelTaskRunUsecase(deps: {
  taskRunRepository: ITaskRunRepository;
  taskRunEventRepository: ITaskRunEventRepository;
}) {
  return async function cancelTaskRunUsecase(
    input: CancelTaskRunInput
  ): Promise<CancelTaskRunOutput> {
    const run = await deps.taskRunRepository.requestCancel(input.runId);
    if (!run) {
      throw new Error("Run not found");
    }

    if (run.state === "cancel_requested") {
      await deps.taskRunEventRepository.append({
        runId: run.runId,
        taskSessionId: run.taskSessionId,
        eventType: "task-run.updated",
        payload: { state: "cancel_requested" },
        dedupeKey: `cancel_requested:${run.runId}`,
      });
    } else if (run.state === "canceled") {
      await deps.taskRunEventRepository.append({
        runId: run.runId,
        taskSessionId: run.taskSessionId,
        eventType: "run.canceled",
        payload: { reason: "cancel_requested" },
        dedupeKey: `canceled:${run.runId}`,
      });
    }

    return { run };
  };
}

export function createGetTaskRunByIdUsecase(taskRunRepository: ITaskRunRepository) {
  return async function getTaskRunByIdUsecase(runId: string): Promise<TaskSessionRun | null> {
    return taskRunRepository.getById(runId);
  };
}

export function createListTaskRunsBySessionUsecase(taskRunRepository: ITaskRunRepository) {
  return async function listTaskRunsBySessionUsecase(
    taskSessionId: string
  ): Promise<TaskSessionRun[]> {
    return taskRunRepository.listByTaskSession(taskSessionId);
  };
}
