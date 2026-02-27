import type { EventRecord, IEventRepository } from "../../domain/repositories/event.repository.js";

export interface ListEventsInput {
  sessionId: string;
  afterSequence?: number;
  afterEventId?: string;
  limit: number;
}

export interface ListEventsOutput {
  sessionId: string;
  events: EventRecord[];
  hasMore: boolean;
  total: number;
  firstSequence: number;
  lastSequence: number;
}

export function createListEventsUsecase(eventRepository: IEventRepository) {
  return async function listEventsUsecase(input: ListEventsInput): Promise<ListEventsOutput> {
    let afterSequence = input.afterSequence;

    if (afterSequence === undefined && input.afterEventId) {
      afterSequence =
        (await eventRepository.getSequenceByEventId(input.sessionId, input.afterEventId)) ??
        undefined;
    }

    const total = await eventRepository.countBySessionId(input.sessionId);
    const events = await eventRepository.listAfter({
      sessionId: input.sessionId,
      afterSequence,
      limit: input.limit,
    });

    const hasMore = events.length > input.limit;
    const eventsToReturn = hasMore ? events.slice(0, input.limit) : events;

    return {
      sessionId: input.sessionId,
      events: eventsToReturn,
      hasMore,
      total,
      firstSequence: eventsToReturn[0]?.sequence ?? 0,
      lastSequence: eventsToReturn[eventsToReturn.length - 1]?.sequence ?? 0,
    };
  };
}
