import type { ITaskRunEventRepository } from "../../domain/repositories/task-run-event.repository.js";
import type {
  ITaskRunRepository,
  TaskRunRuntimeMode,
  TaskSessionRun,
} from "../../domain/repositories/task-run.repository.js";

export interface CreateTaskRunInput {
  taskSessionId: string;
  runtimeMode: TaskRunRuntimeMode;
  clientRequestKey?: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
}

export interface CreateTaskRunOutput {
  run: TaskSessionRun;
  created: boolean;
}

export function createCreateTaskRunUsecase(deps: {
  taskRunRepository: ITaskRunRepository;
  taskRunEventRepository: ITaskRunEventRepository;
}) {
  return async function createTaskRunUsecase(
    input: CreateTaskRunInput
  ): Promise<CreateTaskRunOutput> {
    const existingWithKey = input.clientRequestKey
      ? await deps.taskRunRepository.findByClientRequestKey(
          input.taskSessionId,
          input.clientRequestKey
        )
      : null;

    if (existingWithKey) {
      return { run: existingWithKey, created: false };
    }

    const activeRuns = await deps.taskRunRepository.listByTaskSession(input.taskSessionId);
    const hasActiveRun = activeRuns.some(
      run => run.state === "queued" || run.state === "running" || run.state === "cancel_requested"
    );

    if (hasActiveRun) {
      const activeRun = activeRuns.find(
        run => run.state === "queued" || run.state === "running" || run.state === "cancel_requested"
      );
      if (activeRun) {
        throw new Error("Active run already exists for task session");
      }
    }

    const run = await deps.taskRunRepository.create({
      taskSessionId: input.taskSessionId,
      runtimeMode: input.runtimeMode,
      clientRequestKey: input.clientRequestKey,
      input: input.input,
      metadata: input.metadata,
      maxAttempts: input.maxAttempts,
    });

    await deps.taskRunEventRepository.append({
      runId: run.runId,
      taskSessionId: run.taskSessionId,
      eventType: "task-run.updated",
      payload: {
        state: run.state,
        runtimeMode: run.runtimeMode,
      },
      dedupeKey: `queued:${run.runId}`,
    });

    return { run, created: true };
  };
}
