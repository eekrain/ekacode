import type { ITaskRunEventRepository } from "../../domain/repositories/task-run-event.repository.js";
import type { ITaskRunRepository } from "../../domain/repositories/task-run.repository.js";

export interface ListRunEventsInput {
  runId: string;
  afterEventSeq: number;
  limit: number;
}

export function createListRunEventsUsecase(deps: {
  taskRunRepository: ITaskRunRepository;
  taskRunEventRepository: ITaskRunEventRepository;
}) {
  return async function listRunEventsUsecase(input: ListRunEventsInput) {
    const run = await deps.taskRunRepository.getById(input.runId);
    if (!run) {
      throw new Error("Run not found");
    }

    const events = await deps.taskRunEventRepository.listAfter(
      input.runId,
      input.afterEventSeq,
      input.limit
    );

    return { run, events };
  };
}
