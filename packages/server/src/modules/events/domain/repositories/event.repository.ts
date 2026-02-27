export interface EventRecord {
  eventId: string;
  sessionId: string;
  sequence: number;
  type: string;
  properties: Record<string, unknown>;
  directory?: string;
  timestamp: number;
}

export interface ListEventsInput {
  sessionId: string;
  afterSequence?: number;
  limit: number;
}

export interface IEventRepository {
  getSequenceByEventId(sessionId: string, eventId: string): Promise<number | null>;
  countBySessionId(sessionId: string): Promise<number>;
  listAfter(input: ListEventsInput): Promise<EventRecord[]>;
}
