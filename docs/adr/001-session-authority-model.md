# ADR 001: Session Authority Model

## Status

Accepted

## Context

During the Desktop Streaming and Rendering Remediation (Batch 6), we identified ambiguity around session ownership and authority in the chat pipeline. Multiple components (use-chat hook, workspace view, SSE events) could potentially create or modify session state, leading to:

- Race conditions between optimistic UI updates and server-confirmed state
- Orphaned messages when session IDs transitioned
- Split timelines between optimistic and streamed data
- Unclear responsibility for session lifecycle management

## Decision

We established a **single source of truth** for session authority:

1. **Server is the ultimate authority** for session identity and lifecycle
2. **Session store is the single client-side source of truth** for active session state
3. **Optimistic updates are temporary** and must be reconciled with server state
4. **Session ID transitions trigger migration** of optimistic entities to authoritative paths

### Implementation Details

#### Session Store as Authority

```typescript
// Session store is the single source of truth
const [sessionState, sessionActions] = useSessionStore();

// All session operations go through the store
sessionActions.upsert({ sessionID, directory });
sessionActions.setStatus(sessionID, status);
```

#### Migration on Session ID Transition

When a session ID changes (e.g., from optimistic to server-confirmed):

1. Store the old session ID
2. Create/update the new session
3. Migrate all associated messages and parts
4. Clean up the old session

```typescript
// In event-router-adapter.ts
if (sessionIdChanged) {
  // Migrate messages from old to new session
  const messages = messageActions.getBySession(oldSessionId);
  for (const message of messages) {
    messageActions.upsert({ ...message, sessionID: newSessionId });
  }
}
```

#### Validation at Store Level

Foreign key validation ensures referential integrity:

```typescript
// Message store validates session exists
if (sessionId && !sessionValidator(sessionId)) {
  throw new Error(`Cannot add message: session ${sessionId} not found`);
}

// Part store validates message exists
if (messageId && !messageValidator(messageId)) {
  throw new Error(`Cannot add part: message ${messageId} not found`);
}
```

## Consequences

### Positive

- Clear ownership and responsibility for session state
- No orphaned messages or split timelines
- Predictable state transitions
- Easier debugging and testing
- Enforced data integrity through FK validation

### Negative

- Additional complexity for session migration logic
- Need to handle edge cases (network failures during migration)
- Stricter validation may reject legitimate edge cases

### Neutral

- Requires all code paths to use store actions (no direct state mutation)
- Session creation must precede message creation

## Related Decisions

- ADR 002: Stream Ingestion Source-of-Truth
- ADR 003: Provider Strictness Policy

## References

- `apps/desktop/src/core/stores/session-store.ts`
- `apps/desktop/src/core/stores/message-store.ts`
- `apps/desktop/src/core/domain/event-router-adapter.ts`
- `docs/desktop-streaming-rendering-remediation-plan.md` (WS3)
