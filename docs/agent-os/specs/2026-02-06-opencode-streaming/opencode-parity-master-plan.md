# Master Plan: Exact Opencode Parity (Server, State, UI Rendering)

Date: 2026-02-06  
Status: Draft for execution  
Owner: ekacode core + desktop  
Primary Goal: Make ekacode chat pipeline behave like opencode end-to-end, especially state management and UI rendering.

## 1. Scope and Definition of Done

This plan targets exact behavior parity for:

1. Event protocol and payload contracts (`/event`, bus payloads, ordering)
2. Message + part lifecycle semantics (creation, updates, completion, persistence/replay)
3. Desktop state model (normalized store, event-driven sync, no conflicting state paths)
4. Assistant rendering (part-driven rendering like opencode, consistent order and status handling)
5. Permission interaction model (ask/reply semantics linked to tool parts)
6. Tests and migration cleanup

Done means:

1. Desktop chat rendering is driven by normalized `message` and `part` state populated from bus events.
2. No legacy `/api/events` route usage remains.
3. No dual handling path for assistant messages remains (`MessageBubble` fallback removed for assistant part flows).
4. Reconnect/reload reproduces the same message/part state and UI.
5. Contract tests assert event payload shapes match the opencode parity baseline.

## 2. Parity Baseline (Must Lock Before Coding)

Before implementation starts, lock one exact opencode reference commit and record it in this file:

- `opencode` repo path: `opencode/`
- baseline commit: `<fill-sha>`
- timestamp: `<fill-time>`

Reference files used for parity:

1. `opencode/packages/opencode/src/server/server.ts` (`/event` behavior)
2. `opencode/packages/opencode/src/bus/index.ts`
3. `opencode/packages/opencode/src/session/message-v2.ts`
4. `opencode/packages/opencode/src/session/index.ts` (message/part update publish behavior)
5. `opencode/packages/opencode/src/session/status.ts`
6. `opencode/packages/opencode/src/permission/next.ts`
7. `opencode/packages/ui/src/context/data.tsx`
8. `opencode/packages/opencode/src/cli/cmd/tui/context/sync.tsx` (event -> normalized state sync)
9. `opencode/packages/ui/src/components/message-part.tsx` (part rendering model)

## 3. Current Gaps (Actionable)

1. Legacy route still exists: `packages/server/src/routes/events.ts` and legacy tests still use `/api/events`.
2. Desktop chat still has mixed state paths and still parses UIMessage stream directly in `apps/desktop/src/hooks/use-chat.ts`.
3. Normalized DataContext exists but is not the only source of truth for assistant rendering.
4. Assistant rendering still supports fallback paths that bypass strict part rendering.
5. Session event payloads are only partially aligned with opencode `info` patterns.
6. Permission flow is partially aligned but does not fully mirror opencode propagation behavior.
7. Tests do not yet enforce parity contracts as first-class.

## 4. Target Architecture (Exact Behavior Model)

### 4.1 Server/Core

1. `/api/chat` triggers processing.
2. Processing publishes typed bus events.
3. `/event` streams all bus events as `{ type, properties }`.
4. Events include stable IDs and complete metadata needed by UI.

### 4.2 Desktop

1. Desktop maintains one normalized store:
   - `session`
   - `session_status`
   - `message` (message info by session)
   - `part` (parts by message ID)
   - `permission`
   - `question` (if applicable)
2. Event sync layer consumes `/event` and mutates normalized store.
3. Rendering reads only normalized store and renders parts in deterministic order.
4. `useChat` only handles request dispatch and user input lifecycle, not assistant stream assembly.

## 5. Implementation Plan by Phase

## Phase 0: Prep and Safety

Objective: make the migration deterministic and reviewable.

Tasks:

1. Add parity matrix doc section in this file mapping opencode symbols to ekacode symbols.
2. Add feature flag for migration rollout if needed:
   - `EKACODE_OPENCODE_PARITY=true`
3. Snapshot current behavior with golden traces:
   - capture current `/event` stream for sample sessions
   - capture UI render snapshots for the same sessions

Deliverables:

1. Baseline commit recorded.
2. Golden trace fixtures added under `packages/server/tests/fixtures/parity/`.

Exit criteria:

1. Team agrees on baseline and non-negotiable parity behaviors.

## Phase 1: Event Contract and Legacy Removal

Objective: enforce one event protocol and remove legacy paths.

Detailed tasks:

1. Remove legacy route and references:
   - delete `packages/server/src/routes/events.ts`
   - ensure `packages/server/src/index.ts` does not mount legacy route
   - migrate tests from `/api/events` to `/event`
2. Ensure bus payloads align with opencode patterns:
   - `message.updated -> { info }`
   - `message.part.updated -> { part, delta? }`
   - `message.part.removed -> { sessionID, messageID, partID }`
   - `session.status -> { sessionID, status: { type: idle|busy|retry... } }`
   - `permission.asked/replied` exact shape parity
3. Ensure ordered publish for single stream:
   - per-message event publish queue in chat route
4. Ensure `/event` always sends:
   - `server.connected` first
   - all bus events
   - `server.heartbeat` every 30s
   - closes on `server.instance.disposed`

Files:

1. `packages/server/src/index.ts`
2. `packages/server/src/routes/event.ts`
3. `packages/server/src/routes/chat.ts`
4. `packages/server/src/bus/index.ts`
5. `packages/server/tests/routes/events.test.ts` (rewrite to `/event`)

Verification:

1. Contract tests for each event payload.
2. SSE integration tests for connection, heartbeat, and close semantics.

Exit criteria:

1. No `api/events` string remains in source/tests except migration notes.

## Phase 2: Message and Part Lifecycle Parity

Objective: make lifecycle semantics exactly match opencode.

Detailed tasks:

1. Message info lifecycle:
   - create/update assistant info with created/completed/finish
   - include parent/session/model/provider metadata where available
2. Part lifecycle:
   - text part is stable and updated with deltas
   - reasoning part start/delta/end with stable ID and timing
   - tool part pending -> running -> completed/error with stable call ID mapping
   - on interruption, any non-terminal tool part becomes terminal error
3. Ensure part update schema uses exact part object (no redundant top-level IDs for updates).
4. Align `MessagePartRemoved` usage where deletions occur.
5. Align `SessionStatus` transitions:
   - busy on processing start
   - idle on completion/error
   - retry payload shape if retry behavior is introduced

Files:

1. `packages/server/src/routes/chat.ts`
2. `packages/core/src/chat/message-v2.ts`
3. `packages/core/src/chat/processor.ts`
4. `packages/core/src/session/*` (if lifecycle centralization is needed)

Verification:

1. Lifecycle tests using controlled synthetic stream events.
2. Assertions for stable part IDs and ordered state transitions.

Exit criteria:

1. Same lifecycle trace format as baseline opencode for equivalent scenario inputs.

## Phase 3: Desktop State Management Cutover (Primary Focus)

Objective: replace mixed chat state handling with one normalized opencode-style state.

Detailed tasks:

1. Establish authoritative normalized store:
   - use `apps/desktop/src/contexts/data-context.tsx` as single source of truth
   - remove assistant-output authority from `apps/desktop/src/lib/chat/store.ts` path
2. Create event sync engine (opencode-style):
   - new module: `apps/desktop/src/state/event-sync.ts` (name can vary)
   - subscribe to `/event`
   - apply events to DataContext with upsert/remove semantics:
     - `message.updated`
     - `message.part.updated`
     - `message.part.removed`
     - `session.updated`
     - `session.status`
     - `permission.asked`
     - `permission.replied`
3. Bootstrapping:
   - on app/session load, fetch initial sessions/messages/parts
   - then attach event stream and continue from live updates
4. Remove duplicated pathways:
   - simplify `apps/desktop/src/hooks/use-chat.ts` to submit user prompt only
   - stop assembling assistant messages from raw stream text deltas in that hook
5. Keep UIMessage parser only if required for user-side optimistic rendering, but never as final assistant source.
6. Define deterministic insertion/update policy:
   - binary insert by ID where needed
   - in-place reconcile on existing IDs

Files:

1. `apps/desktop/src/contexts/data-context.tsx`
2. `apps/desktop/src/lib/event-client.ts`
3. `apps/desktop/src/hooks/use-chat.ts`
4. `apps/desktop/src/routes/*` wiring for provider/bootstrap
5. new `apps/desktop/src/state/event-sync.ts`

Verification:

1. Unit tests for reducer/apply-event logic.
2. Reload tests verifying same state reconstruction.
3. Reconnect tests verifying no duplicate/ghost parts.

Exit criteria:

1. Assistant state is produced by event sync + normalized store only.

## Phase 4: UI Rendering Parity (Primary Focus)

Objective: render assistant output from parts exactly like opencode interaction model.

Detailed tasks:

1. Assistant render pipeline:
   - remove mixed fallback branch in `apps/desktop/src/components/assistant-message.tsx`
   - always render assistant via part list + `Part` component registry
2. Registry parity:
   - ensure part components for: text, tool, reasoning, file, error, snapshot, patch, step-start, step-finish
   - register once on boot (`apps/desktop/src/main.tsx`)
3. Text rendering parity:
   - 100ms throttled rendering for streaming text
   - markdown rendering behavior and spacing parity
4. Tool rendering parity:
   - state machine visuals: pending/running/completed/error
   - metadata/attachments details toggles
   - inline permission prompts linked by call ID
5. Reasoning rendering parity:
   - collapsible display
   - streaming indicator until end timestamp exists
6. Ordering and filtering:
   - deterministic part order
   - internal tool filtering parity (`todoread` equivalent behavior)

Files:

1. `apps/desktop/src/components/assistant-message.tsx`
2. `apps/desktop/src/components/message-part.tsx`
3. `apps/desktop/src/components/parts/*.tsx`
4. `apps/desktop/src/components/parts/register.ts`

Verification:

1. Story/test fixtures for each part type and transition.
2. Snapshot tests for known conversation traces.
3. Manual side-by-side comparison against opencode baseline traces.

Exit criteria:

1. User no longer sees fragmented/misaligned chat message handling.

## Phase 5: Permission Exactness

Objective: fully mirror opencode permission ask/reply behavior and UI interaction.

Detailed tasks:

1. Ensure `permission.asked` includes tool linkage fields where available.
2. Implement full reply semantics:
   - `once`: resolve only current request
   - `always`: persist approval and auto-resolve compatible pending requests
   - `reject`: reject current and propagate per opencode behavior rules
3. UI flow:
   - show permission request inline in the corresponding tool part
   - remove pending entries on `permission.replied`

Files:

1. `packages/core/src/security/permission-manager.ts`
2. `packages/server/src/routes/permissions.ts`
3. `apps/desktop/src/hooks/use-permissions.ts`
4. `apps/desktop/src/components/parts/tool-part.tsx`

Verification:

1. Permission integration tests with multiple concurrent pending requests.
2. UI tests for ask/reply/update behavior.

Exit criteria:

1. Permission behavior and visible UX are equivalent to baseline.

## Phase 6: Session Payload and Bootstrap Parity

Objective: align session payload shapes and initial loading semantics.

Detailed tasks:

1. Session event shapes:
   - migrate `session.created/updated` payloads toward `{ info }` pattern
2. Bootstrap order:
   - fetch sessions
   - fetch message infos per session
   - fetch parts per message
   - then subscribe to events
3. Add pruning and bounded memory strategies similar to opencode where needed.

Files:

1. `packages/server/src/bus/index.ts`
2. `packages/server/src/routes/sessions.ts`
3. Desktop bootstrap and sync modules

Verification:

1. Cold start and warm reconnect tests.
2. Large session history tests.

Exit criteria:

1. Identical startup rendering for same persisted state.

## Phase 7: Cleanup and Hardening

Objective: remove temporary compatibility code and lock parity.

Detailed tasks:

1. Delete dead code and adapters:
   - unused chat stores/parsers that are no longer authoritative
   - compatibility branches in assistant rendering
2. Add parity regression test suite:
   - event contract snapshots
   - normalized state replay tests
   - rendering snapshot tests
3. Add CI gates:
   - contract tests mandatory
   - parity replay tests mandatory

Files:

1. `apps/desktop/src/hooks/use-chat.ts` (final simplification)
2. `apps/desktop/src/lib/chat/*` cleanup as needed
3. `packages/server/tests/*`
4. `apps/desktop/tests/*` (or equivalent test location)

Verification:

1. CI green for typecheck + parity tests.
2. Manual side-by-side parity checks.

Exit criteria:

1. No legacy fallback paths left.

## 6. Detailed Work Breakdown by Module

### 6.1 `packages/server`

1. Bus schemas:
   - keep zod contracts strict and documented
   - export event schema for tests to validate runtime payloads
2. Chat route:
   - maintain per-message publish queue
   - ensure finish flushes pending publish queue
3. Event route:
   - keep no-cache and heartbeat semantics
   - ensure auth token query mode continues to work for EventSource

### 6.2 `packages/core`

1. Keep part model equal to opencode where fields exist.
2. Ensure processor semantics map stream events to exact part transitions.
3. Permission manager should support opencode-like propagation rules.

### 6.3 `apps/desktop`

1. State:
   - DataContext is canonical
   - event sync mutates canonical store
2. UI:
   - assistant reads canonical parts only
   - part components are pure renderers over normalized state
3. Hook simplification:
   - `use-chat` handles send/abort only
   - event sync handles assistant updates

## 7. Testing Plan (Mandatory)

1. Contract tests (`packages/server/tests/contracts/event-payloads.test.ts`):
   - one test per event type
2. Sync reducer tests (`apps/desktop/src/state/event-sync.test.ts`):
   - idempotency
   - ordered insert/update
   - remove behavior
3. Rendering tests:
   - text streaming
   - reasoning transition
   - tool transitions
   - permission inline rendering
4. End-to-end parity tests:
   - replay captured opencode-like event traces and assert final normalized state and rendered DOM snapshots

## 8. Risk Register and Mitigations

1. Risk: transient ordering bugs in async publish.
   - Mitigation: strict per-message queue and deterministic reducer operations.
2. Risk: duplicate state writes from old and new pathways.
   - Mitigation: enforce single source of truth and delete obsolete writes early in migration.
3. Risk: UI regressions during cutover.
   - Mitigation: feature flag + snapshot tests + phased rollout.
4. Risk: native dependency failures in chat tests.
   - Mitigation: isolate parity tests from runtime-heavy dependencies using deterministic fixtures/mocks.

## 9. Execution Milestones and Estimated Sequence

1. Week 1:
   - Phase 1 and Phase 2
2. Week 2:
   - Phase 3 (state cutover)
3. Week 3:
   - Phase 4 (UI render parity)
4. Week 4:
   - Phase 5, 6, 7 (permissions/session/bootstrap/cleanup/tests)

## 10. Immediate Next Actions

1. Fill and lock baseline commit metadata in Section 2.
2. Start Phase 1 by deleting `packages/server/src/routes/events.ts` and migrating its tests.
3. Implement `apps/desktop/src/state/event-sync.ts` and wire it into app bootstrap.
4. Remove assistant fallback rendering path and render from normalized parts only.

## 11. Canonical Runtime Contracts (Must Not Drift)

This section is the implementation source of truth for runtime payloads used by server and desktop.

### 11.1 SSE Envelope

Every event streamed from `/event` must be:

```json
{
  "type": "event.name",
  "properties": {}
}
```

Rules:

1. `server.connected` is the first event after connection.
2. `server.heartbeat` is emitted every 30 seconds.
3. No custom non-envelope format is allowed.

### 11.2 `message.updated`

```json
{
  "type": "message.updated",
  "properties": {
    "info": {
      "role": "assistant",
      "id": "message_x",
      "sessionID": "session_x",
      "time": { "created": 1, "completed": 2 },
      "parentID": "message_or_session_parent",
      "modelID": "model",
      "providerID": "provider",
      "finish": "stop"
    }
  }
}
```

Reducer rule:

1. Upsert `info` into `store.message[sessionID]` by `info.id`.
2. Never mutate parts from this event.

### 11.3 `message.part.updated`

```json
{
  "type": "message.part.updated",
  "properties": {
    "part": {
      "id": "part_x",
      "sessionID": "session_x",
      "messageID": "message_x",
      "type": "text"
    },
    "delta": "optional_delta"
  }
}
```

Reducer rule:

1. Upsert by `part.id` under `store.part[messageID]`.
2. If part exists, replace with incoming canonical part.
3. If part does not exist, insert deterministically by ID order.

### 11.4 `message.part.removed`

```json
{
  "type": "message.part.removed",
  "properties": {
    "sessionID": "session_x",
    "messageID": "message_x",
    "partID": "part_x"
  }
}
```

Reducer rule:

1. Remove `partID` from `store.part[messageID]`.
2. Do not remove message info.

### 11.5 `session.status`

```json
{
  "type": "session.status",
  "properties": {
    "sessionID": "session_x",
    "status": { "type": "busy" }
  }
}
```

Retry example:

```json
{
  "type": "session.status",
  "properties": {
    "sessionID": "session_x",
    "status": {
      "type": "retry",
      "attempt": 2,
      "message": "retry reason",
      "next": 1730000000000
    }
  }
}
```

Reducer rule:

1. Replace `store.session_status[sessionID]` with incoming `status`.

### 11.6 Permission Events

Ask:

```json
{
  "type": "permission.asked",
  "properties": {
    "id": "permission_x",
    "sessionID": "session_x",
    "permission": "edit",
    "patterns": ["src/**"],
    "always": ["src/**"],
    "tool": { "messageID": "message_x", "callID": "tool_call_x" }
  }
}
```

Reply:

```json
{
  "type": "permission.replied",
  "properties": {
    "sessionID": "session_x",
    "requestID": "permission_x",
    "reply": "once"
  }
}
```

Reducer rule:

1. `permission.asked`: upsert request by ID under session.
2. `permission.replied`: remove request by `requestID` under session.

## 12. Desktop State Model (Exact Shape and Invariants)

Canonical state (`apps/desktop/src/contexts/data-context.tsx`):

```ts
type Data = {
  session: SessionInfo[];
  session_status: Record<string, SessionStatusInfo>;
  message: Record<string, MessageInfo[]>;
  part: Record<string, Part[]>;
  permission?: Record<string, PermissionRequest[]>;
  question?: Record<string, QuestionRequest[]>;
};
```

Invariants:

1. Every `part[messageID][i]` has `part.messageID === messageID`.
2. `message[sessionID]` entries are unique by `info.id`.
3. `part` is the only source for assistant visible content segments.
4. Rendering order is deterministic and stable across reconnect.
5. Events are idempotent: applying same event twice leaves same final state.

## 13. Event Sync Engine Design

New module:

1. `apps/desktop/src/state/event-sync.ts`

Responsibilities:

1. Connect to `/event` once per active workspace/server.
2. Parse envelope events and dispatch by `type`.
3. Apply deterministic reducers to DataContext.
4. Handle reconnect with bounded backoff and re-bootstrap guard.

Pseudo-flow:

```ts
connect();
onMessage(event) => applyEvent(store, event);
onError() => reconnect();
onReconnect() => ensureBootstrapCompleted();
```

Reducer mapping:

1. `message.updated` -> `upsertMessageInfo`
2. `message.part.updated` -> `upsertPart`
3. `message.part.removed` -> `removePart`
4. `session.status` -> `setSessionStatus`
5. `permission.asked` -> `upsertPermission`
6. `permission.replied` -> `removePermission`

Implementation notes:

1. Use `batch()` for grouped writes to avoid extra renders.
2. Keep reducer functions pure and testable (input state + event => next state).
3. Add dev debug hook to dump reduced events for trace replay.

## 14. `useChat` Refactor Contract

Current issue:

1. `useChat` currently builds assistant output via stream parser and local store.

Target behavior:

1. `useChat` sends user message request and handles abort only.
2. Assistant content is rendered from DataContext via event sync.

Refactor checklist for `apps/desktop/src/hooks/use-chat.ts`:

1. Keep methods:
   - `sendMessage(text)`
   - `stop()`
2. Remove assistant part mutation logic:
   - `appendTextDelta`
   - `addToolCall`
   - `addToolResult`
   - transient assistant placeholder assembly
3. On send:
   - push user message via API or event-backed path
   - set local request lifecycle status (`connecting/streaming`) only
4. On completion:
   - status becomes idle/done based on `session.status` and finish events

## 15. UI Rendering Spec (Primary Focus)

### 15.1 Assistant Rendering Pipeline

File: `apps/desktop/src/components/assistant-message.tsx`

Must do:

1. Resolve assistant message by `message.info`.
2. Read parts only from `store.part[message.info.id]`.
3. Render each part using `Part` registry.
4. Remove fallback rendering path that bypasses part registry for assistant.

### 15.2 Part Registry

File: `apps/desktop/src/components/message-part.tsx` and `apps/desktop/src/components/parts/register.ts`

Required registrations:

1. `text`
2. `tool`
3. `reasoning`
4. `file`
5. `error`
6. `snapshot`
7. `patch`
8. `step-start`
9. `step-finish`

### 15.3 Part Component Behavior

1. Text part (`text-part.tsx`):
   - 100ms throttle for streamed text updates
   - markdown render parity
2. Reasoning part (`reasoning-part.tsx`):
   - collapsible
   - show active indicator while no `time.end`
3. Tool part (`tool-part.tsx`):
   - explicit states: pending/running/completed/error
   - show title, args/input summary, output/error details
   - bind inline permission UI by `tool.callID`
4. Error/file/snapshot/patch components:
   - deterministic condensed summary
   - expandable detail sections

### 15.4 Ordering and Filtering

Rules:

1. Render parts sorted by stable ordering key (ID insertion order parity strategy).
2. Internal utility parts like `todoread` can be filtered only if baseline does the same.
3. Never infer chat mode from ad hoc heuristics once explicit metadata/parts exist.

## 16. Permission Semantics (Exact Behavior)

Files:

1. `packages/core/src/security/permission-manager.ts`
2. `packages/server/src/routes/permissions.ts`
3. `apps/desktop/src/hooks/use-permissions.ts`

Implementation details:

1. `once`:
   - resolve one request, do not persist global approval.
2. `always`:
   - persist approval rule and auto-resolve compatible pending requests for same session.
3. `reject`:
   - reject target request and apply session-level propagation per baseline.

UI behavior:

1. Permission prompt is rendered inline with matching running/pending tool part.
2. Resolving prompt updates both permission queue and tool visual state.

## 17. Bootstrap and Replay Strategy

Objective: make reload/reconnect produce identical UI.

Sequence:

1. Fetch sessions list.
2. Fetch message infos for selected session(s).
3. Fetch parts for each message.
4. Populate DataContext.
5. Subscribe to `/event`.
6. Apply new events incrementally.

Rules:

1. No event should depend on ephemeral local-only IDs.
2. Replay of saved event traces should reconstruct equivalent final state.

## 18. PR-by-PR Execution Plan (Concrete)

PR 1: Event contract hardening

1. Remove legacy route `packages/server/src/routes/events.ts`.
2. Migrate tests to `/event`.
3. Add event contract tests.

PR 2: Desktop event sync foundation

1. Add `apps/desktop/src/state/event-sync.ts`.
2. Wire into app bootstrap.
3. Add reducer tests for core event types.

PR 3: `useChat` simplification

1. Remove assistant stream assembly from `use-chat`.
2. Keep send/abort lifecycle only.
3. Adjust chat status wiring to session/status events.

PR 4: Assistant render cutover

1. Remove fallback rendering path.
2. Complete registry coverage.
3. Add component tests for each part type.

PR 5: Permission parity

1. Implement full reply propagation semantics.
2. Inline permission UI linked to tool part.
3. Add integration tests.

PR 6: Cleanup and parity lock

1. Remove dead stores/parsers.
2. Add trace replay parity tests.
3. Add CI parity gates.

## 19. Acceptance Test Scenarios (Must Pass)

Scenario A: Pure text response

1. `session.status busy` emitted.
2. single text part receives multiple deltas.
3. text part ends with `time.end`.
4. `message.updated` finish set.
5. `session.status idle` emitted.

Scenario B: Tool flow success

1. tool part transitions pending -> running -> completed.
2. output and metadata visible in UI.
3. permission prompt not shown unless asked.

Scenario C: Tool flow denied permission

1. `permission.asked` shown inline.
2. reply `reject` removes request.
3. tool ends in error state with clear reason.

Scenario D: Reconnect/reload

1. bootstrap restores messages and parts.
2. rendering order matches pre-reload.
3. no duplicate part entries.

Scenario E: Interrupted stream

1. active tool parts become terminal error.
2. assistant message marked with finish/error metadata.
3. session status returns to idle.

## 20. Metrics and Instrumentation

Add telemetry/debug counters:

1. event throughput by type
2. reducer apply latency
3. render commit frequency for text part
4. reconnect count and average recovery time
5. duplicate event/part detection count

Performance targets:

1. text rendering updates max every 100ms while streaming
2. event reduce + render path under 16ms average for typical burst
3. no unbounded growth in message/part arrays during long sessions

## 21. Rollback and Safety Strategy

1. Keep migration flag until parity suite is green.
2. If severe regression appears:
   - disable parity flag
   - retain old path for one release window only
3. Do not keep indefinite dual paths after parity stabilization.

## 22. Task Checklist (Execution Tracking)

- [ ] Lock baseline opencode commit SHA
- [ ] Remove `/api/events` route + migrate tests
- [ ] Add event contract test suite
- [ ] Implement desktop event sync engine
- [ ] Switch assistant state source to DataContext only
- [ ] Simplify `useChat` to send/abort lifecycle only
- [ ] Remove assistant fallback renderer
- [ ] Complete part registry coverage
- [ ] Implement full permission reply semantics
- [ ] Add bootstrap + replay tests
- [ ] Add parity trace replay suite
- [ ] Enable CI parity gates and remove legacy code
