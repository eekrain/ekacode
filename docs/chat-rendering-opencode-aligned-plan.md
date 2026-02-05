# Chat Rendering + State Management Overhaul (Opencode-Aligned)

## Goals

- Server-driven state for messages and parts with stable IDs.
- Part-by-ID updates (tool calls/results, reasoning, progress) without duplication.
- Coalesced event stream for smooth streaming and minimal re-renders.
- Session + directory sync layer (hydrate history, load older sessions).
- Persisted settings + session selection.
- Correct chronological rendering of messages and parts.
- Reliable plan/build mode based on server metadata.

---

## Phase 0 - Baseline and Alignment

**Objective:** Lock down current behavior and define the target event contract.

**Tasks**

- Inventory stream payload types in `packages/server/src/routes/chat.ts`.
- Map client routing logic in `apps/desktop/src/hooks/use-chat.ts` and `apps/desktop/src/lib/chat/stream-parser.ts`.
- Identify places where the client invents IDs or routes parts without server IDs.
- Document a unified event schema: `messageId`, `partId`, `partType`, `time`, `status`, `metadata`.

**Acceptance Criteria**

- One documented message/part event schema used by server and client.

---

## Phase 1 - Normalize Data Model (Messages + Parts)

**Objective:** Split message and part storage like OpenCode.

**Tasks**

- Replace inline parts on messages with two stores:
  - `messages.byId` and `messages.order`
  - `parts.byMessageId` (parts sorted by id)
- Add helper APIs: `upsertMessage`, `upsertPart`, `removePart`, `removeMessage`.
- Update rendering to join messages + parts at render time.

**Acceptance Criteria**

- Messages render via `messages.order` + `parts[messageId]`.
- Tool calls/results always update the same part ID.

---

## Phase 2 - Global Event Stream With Coalescing

**Objective:** Mirror OpenCode’s event stream coalescing for smooth UI updates.

**Tasks**

- Add a global event stream listener (coalesce by `messageId:partId`).
- Batch updates per animation frame (16ms) before writing to store.
- Emit all stream updates through a single pipeline (no duplicate handlers).

**Acceptance Criteria**

- Multiple deltas for the same part in a frame coalesce into one update.

---

## Phase 3 - Server-Driven Part Updates

**Objective:** Server is the source of truth for parts.

**Tasks**

- Ensure server assigns IDs to all parts (tool, reasoning, progress, text).
- Emit `message.part.updated` and `message.updated` events consistently.
- Tool call -> tool result -> error must update the same part ID.

**Acceptance Criteria**

- No UI duplication for tool calls/results.
- All part updates are routed as updates-by-ID.

---

## Phase 4 - Session + Directory Sync Layer

**Objective:** Hydrate messages and parts from server history.

**Tasks**

- Implement `session.sync()` behavior:
  - Fetch session info + messages
  - Set `messages` + `parts` in normalized stores
- Add "load earlier messages" and "jump to latest" support.
- Ensure session selection always hydrates full history.

**Acceptance Criteria**

- Switching sessions always shows full history.
- Older messages load without reordering or duplication.

---

## Phase 5 - Rendering and UI Behavior

**Objective:** Correct message order and bubble placement (no client hacks).

**Tasks**

- Remove client-side "preamble/activity/final" routing logic.
- Render based on server parts:
  - Text parts -> assistant bubble
  - Run/Progress/Tool parts -> run card/activity bubble
- Render reasoning/plan based on part metadata or agent mode.

**Acceptance Criteria**

- Preamble renders in its own bubble before tool calls.
- Tool run blocks appear between preamble and final response.
- Final answer renders in a new bubble with correct markdown.

---

## Phase 6 - Persisted Settings and Session State

**Objective:** Preserve session selection and UI settings across reloads.

**Tasks**

- Persist last active session ID per directory.
- Persist UI preferences (show reasoning, compact mode, etc).
- Rehydrate session on app load.

**Acceptance Criteria**

- App restores last session and message list on reload.

---

## Phase 7 - Share-Style Part Updates

**Objective:** Copy OpenCode Share UI part replacement behavior.

**Tasks**

- Implement part update logic:
  - If part exists -> replace in place
  - If part missing -> insert by ID
- Keep message store keyed by ID with part arrays.

**Acceptance Criteria**

- Part updates never create duplicates.

---

## Phase 8 - Tracing + Tests

**Objective:** Prevent regressions and confirm stream order.

**Tasks**

- Add a stream trace tool that records:
  - Event order
  - Routing target message
  - Update type (insert/replace)
- Add tests for:
  - Part update by ID
  - Tool call/result updates same part
  - Message ordering stability

**Acceptance Criteria**

- Trace confirms correct order/routing with no duplicates.
- Tests pass for core update flows.

---

## Phase 9 - Cleanup and Migration

**Objective:** Remove legacy routing and dead code.

**Tasks**

- Remove old preamble/activity/final logic in `use-chat`.
- Remove any duplicate data pathways.
- Update docs with new architecture.

**Acceptance Criteria**

- Only server-driven path remains.

---

## Checklist (No Estimates)

- [ ] Finalize unified message/part event schema.
- [ ] Split store into normalized messages + parts.
- [ ] Add global event stream with coalescing.
- [ ] Ensure server emits stable part IDs and updates.
- [ ] Add session/directory sync hydration.
- [ ] Move rendering logic to server parts (no client splits).
- [ ] Add persisted session + UI settings.
- [ ] Implement Share-style part updates.
- [ ] Add trace + tests.
- [ ] Remove legacy routing code.
