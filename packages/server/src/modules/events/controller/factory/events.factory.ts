import { createListEventsUsecase } from "../../application/usecases/list-events.usecase.js";
import { eventRepository } from "../../infrastructure/repositories/event.repository.drizzle.js";

export function buildEventUsecases() {
  return {
    listEventsUsecase: createListEventsUsecase(eventRepository),
  };
}
