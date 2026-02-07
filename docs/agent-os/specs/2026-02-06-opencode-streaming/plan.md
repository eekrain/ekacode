# Plan: Opencode-Style Streaming Architecture Migration

**Date**: 2026-02-06
**Status**: In Progress
**Scope**: Complete replacement of ekacode streaming with Opencode patterns

## Overview

Migrate ekacode from the current complex, fragmented streaming implementation to Opencode's clean, event-driven architecture. This involves replacing the SSE protocol, part-based data model, event bus system, and UI rendering patterns.

**User Goal**: "I just don't like our streaming processing, the data looks bad, and it causes the UI to render bad too, hard to understand the workflow unlike opencode. I want to just follow how opencode does this, throw out all the current junk."

## Progress Summary

### Completed ✅

1. **Event Bus System** (`packages/server/src/bus/`)
   - Created `bus-event.ts` with Zod schema-based event registry
   - Created `index.ts` with publish/subscribe functions
   - Defined core events: ServerConnected, ServerHeartbeat, ServerInstanceDisposed, MessageUpdated, MessagePartUpdated, MessagePartRemoved, SessionCreated, SessionUpdated, SessionStatus

2. **Part Types and Message Schema** (`packages/core/src/chat/`)
   - Created `message-v2.ts` with Opencode-style part types
   - Defined: TextPart, ReasoningPart, ToolPart, FilePart, StepStartPart, StepFinishPart, ErrorPart, SnapshotPart, PatchPart
   - Tool state machine: ToolStatePending, ToolStateRunning, ToolStateCompleted, ToolStateError
   - Message helpers: createUserMessage, createAssistantMessage, createSystemMessage

3. **SSE /event Endpoint** (`packages/server/src/routes/event.ts`)
   - Replaced old `/api/events` with Opencode-style `/event` endpoint
   - Unified event format: `{ type, properties }`
   - Server-connected confirmation on connection
   - 30s heartbeat to prevent WebView timeout
   - Session-based event filtering

4. **Session Processor** (`packages/core/src/chat/processor.ts`)
   - Processes AI SDK stream events
   - Converts to part-based events
   - Handles text, reasoning, tool calls, steps, errors
   - Emits bus events for each part update

5. **Client Event System** (`apps/desktop/src/lib/event-client.ts`)
   - Native EventSource with coalescing
   - 8ms yield to event loop
   - ~60fps batched updates (16ms target)
   - Event deduplication by coalescing key

6. **Data Context** (`apps/desktop/src/contexts/data-context.tsx`)
   - Opencode-style normalized data store
   - SolidJS signals for reactivity
   - Helper functions: updateMessage, updatePart, addPart, removePart

### Remaining Tasks

1. **UI Components** (Phase 4)
   - Part component registry
   - Text part with throttling (100ms)
   - Tool part with state machine
   - Assistant message display

2. **Migration & Cleanup** (Phase 5)
   - Delete old streaming code
   - Update type definitions
   - Integration testing

## Architecture

### Current Ekacode (What We Had)
```
┌─────────────────────────────────────────────────────────────┐
│ Current: Complex, Fragmented                                │
├─────────────────────────────────────────────────────────────┤
│ • 10+ custom data-* event types (data-state, data-thought,  │
│   data-action, data-run-item, data-run, data-tool-call,    │
│   data-tool-result, etc.)                                   │
│ • Three-message split (preamble + activity + final)        │
│ • Client-side mode routing via heuristics                   │
│ • Double parsing (SSE + raw protocol fallback)              │
│ • Separate stores (messages + events + reasoning)           │
│ • Inconsistent coalescing (some events, not others)         │
│ • High-frequency updates (50-100/sec) without throttling   │
└─────────────────────────────────────────────────────────────┘
```

### Opencode Architecture (What We're Building)
```
┌─────────────────────────────────────────────────────────────┐
│ Opencode: Clean, Event-Driven                               │
├─────────────────────────────────────────────────────────────┤
│ • Unified event format: { type, properties }                │
│ • Single message with typed parts array                     │
│ • Server-driven mode via part types                         │
│ • Pure SSE with heartbeat (30s)                             │
│ • Normalized storage (messages + parts separate)           │
│ • Event coalescing at source (8ms yield, 60fps flush)      │
│ • Throttled rendering (100ms for text parts)               │
└─────────────────────────────────────────────────────────────┘
```

## Key Files Created

### Server-Side
- `packages/server/src/bus/bus-event.ts` - Event registry
- `packages/server/src/bus/index.ts` - Event bus implementation
- `packages/server/src/routes/event.ts` - SSE /event endpoint
- `packages/core/src/chat/message-v2.ts` - Part type definitions
- `packages/core/src/chat/processor.ts` - AI SDK stream processor
- `packages/core/src/chat/index.ts` - Module exports

### Client-Side
- `apps/desktop/src/lib/event-client.ts` - Event client with coalescing
- `apps/desktop/src/contexts/data-context.tsx` - Data context and helpers

## Success Criteria (Tracking)

1. ✅ Single SSE `/event` endpoint replaces all `data-*` events
2. ✅ Parts stored normalized (by messageID)
3. ✅ Event coalescing prevents UI jank
4. ⏳ Text rendering throttled (100ms) - Pending UI implementation
5. ⏳ Tool states visible (pending/running/completed/error) - Pending UI implementation
6. ✅ No client-side mode heuristics
7. ⏳ All old streaming code removed - Pending cleanup
8. ✅ Tests pass for new system

## Next Steps

1. Create part component registry
2. Implement text part with throttling
3. Implement tool part with state machine
4. Create assistant message display
5. Delete old streaming code
6. Run manual verification tests
