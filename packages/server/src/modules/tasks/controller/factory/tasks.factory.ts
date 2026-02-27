import {
  createListTasksBySessionUsecase,
  createListTasksUsecase,
} from "../../application/usecases/list-tasks.usecase.js";
import { taskRepository } from "../../infrastructure/repositories/task.repository.memory.js";

export function buildTaskUsecases() {
  return {
    listTasksBySessionUsecase: createListTasksBySessionUsecase(taskRepository),
    listTasksUsecase: createListTasksUsecase(taskRepository),
  };
}
