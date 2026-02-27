import { createCreateTaskSessionUsecase } from "../../application/usecases/create-task-session.usecase.js";
import {
  createGetLatestTaskSessionByWorkspaceUsecase,
  createListTaskSessionsUsecase,
} from "../../application/usecases/list-task-sessions.usecase.js";
import {
  createDeleteTaskSessionUsecase,
  createGetTaskSessionUsecase,
  createUpdateTaskSessionUsecase,
} from "../../application/usecases/update-task-session.usecase.js";
import { taskSessionRepository } from "../../infrastructure/repositories/task-session.repository.drizzle.js";

export function buildTaskSessionUsecases() {
  return {
    createTaskSessionUsecase: createCreateTaskSessionUsecase(taskSessionRepository),
    listTaskSessionsUsecase: createListTaskSessionsUsecase(taskSessionRepository),
    getTaskSessionUsecase: createGetTaskSessionUsecase(taskSessionRepository),
    updateTaskSessionUsecase: createUpdateTaskSessionUsecase(taskSessionRepository),
    deleteTaskSessionUsecase: createDeleteTaskSessionUsecase(taskSessionRepository),
    getLatestTaskSessionByWorkspaceUsecase:
      createGetLatestTaskSessionByWorkspaceUsecase(taskSessionRepository),
  };
}
