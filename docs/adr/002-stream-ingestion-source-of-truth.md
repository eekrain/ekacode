# ADR 002: Stream Ingestion Source-of-Truth

## Status

Accepted

## Context

The desktop application receives streaming data from two sources:

1. **Direct HTTP stream** from chat API (during active generation)
2. **SSE events** from the event endpoint (for catch-up and real-time updates)

This dual-source architecture created several issues:

- Duplicated or conflicting events from both sources
- Unclear precedence when the same data arrived via different paths
- Race conditions between stream completion and SSE catch-up
- Inconsistent state if one source failed or was delayed

## Decision

We established **unified event ingestion** with the following principles:

1. **All events flow through the event router adapter** regardless of source
2. **Deduplication by eventId** prevents duplicates from multiple sources
3. **Ordering buffer ensures sequence** even when events arrive out of order
4. **SSE is the authoritative source** for catch-up and reconciliation

### Implementation Details

#### Unified Event Processing

```typescript
// All events go through applyEventToStores
export async function applyEventToStores(
  event: ServerEvent,
  messageActions: MessageActions,
  partActions: PartActions,
  sessionActions: SessionActions
): Promise<ServerEvent[]> {
  // 1. Comprehensive validation
  const validation = validateEventComprehensive(event);
  if (!validation.valid) {
    logger.warn("Event validation failed", { error: validation.error });
    return [];
  }

  // 2. Deduplication check
  if (deduplicator.isDuplicate(event.eventId)) {
    return [];
  }

  // 3. Ordering - add to buffer and get processable events
  const eventsToProcess = await orderingBuffer.addEvent(event);

  // 4. Process all events that are now ready
  for (const evt of eventsToProcess) {
    processEvent(evt, messageActions, partActions, sessionActions);
  }

  return eventsToProcess;
}
```

#### Deduplication Strategy

- Use eventId (UUIDv7) as unique identifier
- Maintain a sliding window of seen event IDs
- Reject duplicates within the window

```typescript
const deduplicator = new EventDeduplicator({
  maxSize: 1000, // Keep last 1000 event IDs
});
```

#### Ordering Strategy

- Buffer events until sequence is contiguous
- Handle out-of-order arrival
- Timeout for stuck sequences

```typescript
const orderingBuffer = new EventOrderingBuffer({
  timeoutMs: 30000, // 30 second timeout
  maxQueueSize: 1000,
});
```

#### SSE Catch-up Flow

When reconnecting with `lastEventId`:

1. Fetch missed events from `/api/events/catchup`
2. Apply events through same pipeline (validation → dedup → ordering)
3. Continue with live SSE stream
4. Deduplication handles any overlap

```typescript
const fetchCatchUpEvents = async (): Promise<void> => {
  if (!enableCatchUp || !lastEventId) return;

  const url = new URL(`${baseUrl}/api/events/catchup`);
  url.searchParams.set("lastEventId", lastEventId);

  const response = await fetch(url.toString());
  const data = await response.json();

  for (const event of data.events) {
    onEvent?.(event); // Goes through same pipeline
  }
};
```

## Consequences

### Positive

- Single code path for all event processing
- Consistent validation and error handling
- Automatic deduplication across sources
- Ordered processing regardless of arrival order
- Clear precedence (SSE for catch-up)

### Negative

- Additional latency from ordering buffer
- Memory overhead from deduplication window
- Complexity of ordering timeout handling

### Neutral

- All consumers must use the event router adapter
- Event IDs must be globally unique (UUIDv7)

## Related Decisions

- ADR 001: Session Authority Model
- ADR 003: Provider Strictness Policy

## References

- `apps/desktop/src/core/domain/event-router-adapter.ts`
- `apps/desktop/src/infrastructure/events/event-source.ts`
- `packages/shared/src/event-deduplication.ts`
- `packages/shared/src/event-ordering.ts`
- `docs/desktop-streaming-rendering-remediation-plan.md` (WS2, WS5)
