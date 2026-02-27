import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../../../../../db/index.js";
import { events } from "../../../../../db/schema.js";
import type {
  EventRecord,
  IEventRepository,
  ListEventsInput,
} from "../../domain/repositories/event.repository.js";

export class DrizzleEventRepository implements IEventRepository {
  async getSequenceByEventId(sessionId: string, eventId: string): Promise<number | null> {
    const row = await db
      .select({ sequence: events.sequence })
      .from(events)
      .where(and(eq(events.session_id, sessionId), eq(events.event_id, eventId)))
      .limit(1);
    return row[0]?.sequence ?? null;
  }

  async countBySessionId(sessionId: string): Promise<number> {
    const result = await db
      .select({ count: db.$count(events) })
      .from(events)
      .where(eq(events.session_id, sessionId));
    return result[0]?.count ?? 0;
  }

  async listAfter(input: ListEventsInput): Promise<EventRecord[]> {
    const conditions =
      input.afterSequence !== undefined
        ? and(eq(events.session_id, input.sessionId), gt(events.sequence, input.afterSequence))
        : eq(events.session_id, input.sessionId);

    const rows = await db
      .select({
        event_id: events.event_id,
        session_id: events.session_id,
        sequence: events.sequence,
        event_type: events.event_type,
        properties: events.properties,
        directory: events.directory,
        created_at: events.created_at,
      })
      .from(events)
      .where(conditions)
      .orderBy(asc(events.sequence))
      .limit(input.limit + 1);

    return rows.map(row => ({
      eventId: row.event_id,
      sessionId: row.session_id,
      sequence: row.sequence,
      type: row.event_type,
      properties: row.properties,
      directory: row.directory ?? undefined,
      timestamp: row.created_at.getTime(),
    }));
  }
}

export const eventRepository = new DrizzleEventRepository();
