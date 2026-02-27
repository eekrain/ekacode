import {
  createCancelTaskRunUsecase,
  createGetTaskRunByIdUsecase,
  createListTaskRunsBySessionUsecase,
} from "../../application/usecases/cancel-task-run.usecase.js";
import { createCreateTaskRunUsecase } from "../../application/usecases/create-task-run.usecase.js";
import { createListRunEventsUsecase } from "../../application/usecases/list-run-events.usecase.js";
import { taskRunEventRepository } from "../../infrastructure/repositories/task-run-event.repository.drizzle.js";
import { taskRunRepository } from "../../infrastructure/repositories/task-run.repository.drizzle.js";

export function buildTaskRunUsecases() {
  return {
    getTaskRunByIdUsecase: createGetTaskRunByIdUsecase(taskRunRepository),
    listTaskRunsBySessionUsecase: createListTaskRunsBySessionUsecase(taskRunRepository),
    createTaskRunUsecase: createCreateTaskRunUsecase({
      taskRunRepository,
      taskRunEventRepository,
    }),
    cancelTaskRunUsecase: createCancelTaskRunUsecase({
      taskRunRepository,
      taskRunEventRepository,
    }),
    listRunEventsUsecase: createListRunEventsUsecase({
      taskRunRepository,
      taskRunEventRepository,
    }),
  };
}
