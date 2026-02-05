# Chat Rendering & Streaming Improvement Plan (Comprehensive)

This document consolidates **all findings so far** about the chat/streaming pipeline and lays out a **detailed improvement plan**. It is intentionally exhaustive for future research and debugging.

---

## 0) Scope & Goals

**Primary goals**

- Deterministic rendering order: intro text → tool activity → final answer, each in the correct bubble.
- Stable tool rows: tool results should **update the same row**, not append a new one.
- Correct mode routing: **planning/build/chat** should reflect actual agent behavior, not default to planning.
- Correct markdown rendering and no raw JSON in user-facing bubbles.
- Efficient streaming: no UI lag or duplicate events while streaming.

**Secondary goals**

- Maintain strict alignment between server stream parts and client part updates.
- Improve debuggability: traceability of message IDs, part IDs, toolCallIds, and mode transitions.

---

## 1) Systems & File Map (Where Things Happen)

### A) Server stream generation

- **`packages/server/src/routes/chat.ts`**
  - Creates the UIMessage stream with `createUIMessageStream`.
  - Emits:
    - `text-delta`
    - `tool-call` / `tool-result`
    - `data-*` parts such as `data-run`, `data-run-group`, `data-run-item`, `data-action`, `data-thought`, `data-mode-metadata`
  - Maintains `modeState` and controls mode transitions.

### B) Stream parser (desktop)

- **`apps/desktop/src/lib/chat/stream-parser.ts`**
  - Parses AI SDK stream protocol.
  - Emits callbacks:
    - `onTextDelta`
    - `onToolCallStart`, `onToolCallEnd`, `onToolResult`
    - `onDataPart`
    - `onComplete`, `onError`
  - Handles both SSE (`data: {...}`) and raw line protocol (`0:`, `b:`, `d:`, `8:`).

### C) Chat store (desktop)

- **`apps/desktop/src/lib/chat/store.ts`**
  - Normalized store for O(1) updates: `messages.order + messages.byId`.
  - Key methods:
    - `appendTextDelta()`
    - `addToolCall()`
    - `addToolResult()`
    - `updateDataPart(type, id, data)` (updates in place if `type + id` match).

### D) Chat hook (desktop)

- **`apps/desktop/src/hooks/use-chat.ts`**
  - Routes streamed content into **preamble / activity / final** assistant messages.
  - Preamble: text before tool calls.
  - Activity: tool calls + data parts.
  - Final: buffered text after tool calls.
  - Controls metadata for mode routing (`data-mode-metadata`, `data-action`, `data-thought`).

### E) UI routing

- **`apps/desktop/src/components/assistant-message.tsx`**
  - Chooses mode per message:
    - `build` if tool parts or `data-action`
    - `planning` if `data-run`/`data-run-item`
    - otherwise use metadata or fallback to `chat`.
- **`apps/desktop/src/components/activity-feed/index.tsx`**
  - Build mode renderer: tool parts preferred, events fallback.
- **`apps/desktop/src/components/run-card/index.tsx`**
  - Planning mode renderer: run card, run groups, run items.
- **`apps/desktop/src/components/message-parts.tsx`**
  - Renders `text`, `tool-call`, `tool-result`.
  - Intentionally hides `data-*` parts inline to avoid duplication.

### F) Reference: opencode state model

- **`opencode/packages/opencode/src/session/message-v2.ts`** — message/part schema
- **`opencode/packages/opencode/src/session/processor.ts`** — streaming → part updates
- **`opencode/packages/opencode/src/share/share.ts`** — bus → share sync
- **`opencode/packages/web/src/components/Share.tsx`** — part updates merged by id
- **`opencode/packages/web/src/components/share/part.tsx`** — part-specific UI rendering

---

## 2) Current Observed Symptoms (from your reports)

1. **Tool rows duplicate**
   - Tool result appears as a new row instead of updating the pending row.
2. **Ordering is wrong**
   - Tool call appears first, then preamble text (or answer text appears in the wrong bubble).
3. **Mode stuck in planning**
   - UI always uses planning view even when tools are used.
4. **Progress updates never update**
   - Planning “Progress Updates” shows empty or stale list.
5. **Raw JSON leaks into UI**
   - Action rows show raw JSON instead of a clean summary.
6. **Markdown not rendered in some bubbles**
   - Text renders as raw markdown rather than formatted.

---

## 3) Pipeline Walkthrough (Actual Data Flow)

### Step 1 — Server stream emits

In `packages/server/src/routes/chat.ts`, the stream uses `writer.write(...)` for each part.
Typical flow:

1. `data-state` (running)
2. `data-mode-metadata` if mode changes
3. `data-run` / `data-run-group` if planning initialized
4. `data-thought` (reasoning)
5. `tool-call` then `data-action` (tool event)
6. `tool-result` then `data-action` update
7. `text-delta` (final response)
8. `finish`

### Step 2 — Stream parser converts protocol → callbacks

`apps/desktop/src/lib/chat/stream-parser.ts`:

- Text: `onTextDelta` (frequent)
- Tool input: `onToolCallStart` → `onToolCallEnd`
- Tool result: `onToolResult`
- Custom data: `onDataPart(type, id, data)`

### Step 3 — Chat hook splits into 3 messages

`apps/desktop/src/hooks/use-chat.ts`:

- **Preamble message**: first assistant bubble, text deltas before any tool calls.
- **Activity message**: second assistant bubble, all tool calls and all `data-*` parts.
- **Final message**: third assistant bubble, buffered text after tool calls.

### Step 4 — Store updates

`apps/desktop/src/lib/chat/store.ts`:

- Tool calls and tool results update parts in the **same message**, in-place if IDs match.
- Data parts update in-place if `type + id` match.

### Step 5 — UI routes by mode

`apps/desktop/src/components/assistant-message.tsx`:

- If message contains **tool parts** or **data-action**, route to **build**.
- If message contains **data-run** parts, route to **planning**.
- Otherwise **chat** bubble.

---

## 4) Opencode Reference Architecture (What They Do Right)

### Opencode core principles

- **Stable part IDs**: parts are created once and updated in place.
- **Part updates are merges**: no append for updates.
- **UI always renders parts by ID**: stream events never create duplicates.

### Concrete implementation patterns (opencode)

- `opencode/packages/web/src/components/Share.tsx`
  - on `session/part` update: find part by `id` and replace (not append).
- `opencode/packages/opencode/src/session/processor.ts`
  - tool state transitions update same part id.
- `opencode/packages/opencode/src/session/index.ts`
  - `updatePart` emits `MessageV2.Event.PartUpdated` with `part` + `delta`.

### Why it matters

This architecture prevents duplication and ensures stable rendering during high-frequency streams.

---

## 5) Root Cause Analysis (Most Likely Causes)

### RC‑1: **Planning mode triggered too early**

- In `packages/server/src/routes/chat.ts`, `detectMode()` switches to **planning** as soon as `reasoning-start` happens.
- On planning transition, server emits `data-run` and `data-run-group`.
- UI will route to **planning** if it sees `data-run` parts, even if later tool calls occur.

**Impact**: UI gets locked into planning view; build mode never shown.

**Evidence**:

- `detectMode()` logic considers `reasoning-start` → planning.
- `data-run` emitted immediately when planning starts.

### RC‑2: **Tool rows duplicate because update doesn’t find the original part**

- `addToolResult()` updates an existing tool-call part only if `toolCallId` matches.
- If tool-call part is missing or was attached to a different message, the store adds a new `tool-result` part.

**Common causes**:

- Tool-call part went into **activity message** but tool result was routed elsewhere.
- `toolCallId` mismatch or missing.

### RC‑3: **Data parts sometimes double-prefixed (`data-data-*`)**

- UI already guards against this in `run-card` and `assistant-message`.
- But `use-chat` metadata logic only checks exact `data-action` / `data-thought` types.
- If stream yields `data-data-action`, metadata and mode updates might not trigger.

### RC‑4: **Tool events arrive but UI shows raw JSON**

- When only `data-action` exists and **tool parts are absent**, `ActivityFeed` falls back to `ActionRow`.
- `ActionRow` shows subtitle from event, which can be raw JSON snippet.

### RC‑5: **Text bubbles appear in wrong place**

- `use-chat` buffers text after first tool call and places it in the **final** message.
- If tool calls happen early, the preamble is empty or minimal.
- This makes it look like tools came “before” the text.

---

## 6) Deep Dive: Server Emission Logic

**File**: `packages/server/src/routes/chat.ts`

### Key mechanisms

- `detectMode()`:
  - `reasoning-start` → planning (if no tool calls yet)
  - `tool-call` → build
- On mode transition to planning:
  - emits `data-run` + `data-run-group`
- On tool call:
  - emits `tool-call`
  - emits `data-action` (AgentEvent)
  - emits `data-run-item` if planning mode
- On tool result:
  - emits `tool-result`
  - emits `data-action` update (same toolCallId)

### Known risk

If planning is entered early, it pushes `data-run` parts into the stream, which then dominate UI routing.

---

## 7) Deep Dive: Client Mode Routing

**File**: `apps/desktop/src/components/assistant-message.tsx`

Decision tree:

1. If `tool-call`/`tool-result` or `data-action`/`data-data-action` exists → **build**.
2. If metadata exists and mode is not planning → use metadata.
3. If `data-run`/`data-run-item` exists → **planning**.
4. Otherwise → **chat**.

### Implication

If tool parts do not show up (or data-action missing), the presence of `data-run` forces planning.

---

## 8) Trace Plan (Live Request Trace)

This is how to trace a single live request without fixing behavior yet.

### Step 1 — Server: log every stream write

Add temporary logs around each `writer.write(...)` in `packages/server/src/routes/chat.ts`:

- log type, id, toolCallId, and messageId
- ensure each stream event is visible with its payload size

### Step 2 — Parser: confirm raw stream parts

`apps/desktop/src/lib/chat/stream-parser.ts` already logs parsed types.

- ensure logger is visible in runtime console
- verify order: reasoning → mode metadata → tool-call → data-action → tool-result → text

### Step 3 — Hook: log routing decisions

In `apps/desktop/src/hooks/use-chat.ts` (temporary instrumentation):

- log when preamble/activity/final messages are created
- log which messageId each part is routed to
- log toolCallId linkage between tool-call and tool-result

### Step 4 — UI: render diagnostic part list (optional)

Add a dev-only debug section in `MessageBubble` or `AssistantMessage`:

- list `part.type`, `part.id`, `toolCallId` to see actual message state

### Expected output of trace

A complete timeline showing:

- stream event order
- part → message routing
- final messages with their parts

---

## 9) Opencode Alignment Plan (Mapping to Your Code)

### Opencode pattern: part updates are _id-stable_ and _in-place_

Your store supports this already via `updateDataPart()` and `addToolResult()`.

**Plan to align**:

- Ensure `toolCallId` is always attached to the same message for both tool-call and tool-result.
- Ensure data-action updates use identical `type` + `id` so `updateDataPart()` replaces instead of appending.
- Ensure metadata is derived from **message parts**, not a global `currentMetadata`.

---

## 10) Improvement Plan (Phased)

### Phase 1 — Instrumentation & Trace (no behavior changes)

- Add server write logs for stream types and IDs.
- Add stream parser logs for part types and IDs (already present, ensure visible).
- Add use-chat routing logs to show which message receives which part.
- Collect one trace for each scenario:
  - reasoning + no tool calls
  - reasoning + tool calls
  - tool calls first, then text

**Deliverable**: a single trace log file with end-to-end mapping.

### Phase 2 — Mode correctness

- Reconcile `detectMode()` with UI mode routing.
- Ensure planning mode is only used when desired.
- Prevent `data-run` emission if build is imminent (or defer until no tool calls appear).

### Phase 3 — Tool row updates

- Guarantee `toolCallId` identity across tool-call and tool-result.
- Ensure tool-call part exists before tool-result part is written.
- Confirm `data-action` update uses same `type + id` as initial data-action.

### Phase 4 — Bubble ordering

- If tools occur early, decide whether:
  - allow preamble to be empty and final answer is separate bubble (current behavior), or
  - always render initial text bubble first (requires buffering before tool calls).

### Phase 5 — Presentation cleanup

- Avoid raw JSON in ActionRow subtitle.
- Markdown rendering for all text parts.
- Ensure data-action only appears when tool parts are absent (or format ActionRow safely).

### Phase 6 — Tests / Regression checks

- Add integration test for streaming order:
  - verify tool-call and tool-result update same row.
  - verify `data-run` does not override build when tool-call exists.

---

## 10.1) State Management Alignment Plan (Adopt Opencode Patterns)

This section focuses on **state architecture**, not styling. The goal is to improve session persistence, history hydration, and part-by-id updates using the same design patterns opencode uses.

### A) Server-Driven State (Global Sync)

**Opencode pattern**

- `opencode/packages/app/src/context/global-sync.tsx`
  - Central event bus → store updates.
  - All state updates are **id-stable** and **in-place** using `Binary.search + reconcile`.
  - `message` and `part` are separate maps keyed by IDs.

**Why this matters**

- Your current flow is stream-driven only; history hydration and server events are not unified.
- A global sync layer prevents “missing history” or stale session data.

**Recommendation**

- Introduce a `global-sync` style store that listens to server events (or polling) and keeps message/part maps consistent with server state.
- Use `reconcile(..., { key: "id" })` on all message/part updates.

### B) Directory/Session Sync Layer (History + Pagination)

**Opencode pattern**

- `opencode/packages/app/src/context/sync.tsx`
  - `sync.session.get()` and `sync.session.history.loadMore()`
  - Loads messages + parts in chunks.
  - Uses `meta.limit`, `meta.complete`, `meta.loading` to support pagination.

**Why this matters**

- Your current session history appears broken (“old session did not populate”).
- There is no explicit hydration layer that merges history + streaming state.

**Recommendation**

- Implement a session sync layer that:
  - Fetches messages and parts on session selection.
  - Reconciles them into the store with stable IDs.
  - Supports pagination for long sessions.
  - Does not depend on active streaming to render history.

### C) Persisted Settings + Local State

**Opencode pattern**

- `opencode/packages/app/src/context/settings.tsx`
- `opencode/packages/app/src/utils/persist.ts`
  - All settings use `persisted()` wrappers.
  - Contexts gate rendering until ready.

**Why this matters**

- Session mode, model selection, or UI preferences should survive reloads.

**Recommendation**

- Add a persisted settings context for chat mode, selected model, UI preferences.
- Use a `createSimpleContext` equivalent to gate UI until settings load.

### D) Web Share UI (Stream Rendering)

**Opencode pattern**

- `opencode/packages/web/src/components/Share.tsx`
  - `createStore` with `messages: Record<string, MessageWithParts>`.
  - On part updates: find part by `id` and replace (no duplication).
  - Messages and parts stored separately; parts re-rendered in place.

**Why this matters**

- Directly addresses duplicate tool rows and stale updates.
- Encourages **in-place part updates** rather than re-append.

**Recommendation**

- Mirror the `messages + parts` separation even in desktop chat store.
- On `message.part.updated`, always replace by ID instead of pushing.

### E) Implementation Strategy (Incremental)

1. **Add global sync store** (event bus or polling from server).
2. **Add session sync layer** for history hydration.
3. **Refactor chat store** so messages/parts are separate maps.
4. **Unify streaming + history updates** through the same update paths.
5. **Persist settings** for mode/model/UI.

### F) Migration Checklist (No Estimates)

- Define a `GlobalSync` store (message, part, session, status) keyed by IDs.
- Implement server event intake (or polling) that emits `message.updated` and `message.part.updated`.
- Add `SessionSync` utilities to hydrate history on session selection.
- Ensure session history loads **before** streaming renders (gated by `ready`).
- Refactor chat state to separate `messages` and `parts` collections.
- Update all tool events to **replace part by id**, never append for updates.
- Normalize `data-*` part types (avoid `data-data-*` or handle both everywhere).
- Ensure tool-call and tool-result share the same `toolCallId` and update the same part.
- Add persisted settings for mode, model, and UI preferences.
- Add an integration test that verifies:
  - history loads when selecting an old session
  - tool-result updates the same row
  - mode routing doesn’t stick to planning when tool calls exist

### G) Architecture Diagram (Current vs Desired)

#### Current (Stream-Only, Split Messages)

```
Server (stream)
  ├─ text-delta ──────────────┐
  ├─ tool-call/result ────────┼─> Stream Parser
  ├─ data-* ──────────────────┘
                                │
                                v
                         use-chat.ts
                      ┌────────┼────────┐
                      │        │        │
               preamble msg  activity msg  final msg
                   (text)     (tools+data)  (buffered text)
                      │        │        │
                      └────────┴────────┘
                         Local Chat Store
                         (messages only)
                                │
                                v
                         UI mode router
```

---

## 11) Implementation Plan (Opencode-Aligned, Comprehensive)

This plan turns the learnings into a step-by-step path to an opencode-style architecture: stable message ids, part-by-id updates, server-driven sync, and reliable UI routing. It is intentionally detailed and ordered to minimize regressions.

### Phase 0 - Alignment Decisions (Design Lock)

- Decide if the assistant response should be a single message with parts (opencode style) or still split into preamble/activity/final.
  - Recommendation: single assistant message per response, all parts attached to the same message id.
- Confirm if run cards (planning) are a product feature or a debug-only view.
  - If product feature: gate run card emission by explicit mode, not reasoning-start.
- Confirm tool-result should update same tool row (answered: yes).

### Phase 1 - Data Model and Store Refactor

Goal: move to stable id updates and unify message+part identity.

1. **Introduce part storage keyed by id**
   - Add `parts.byId` and `parts.byMessage` in chat store.
   - Stop using `type + id` for updates; use part id only.
   - Provide helpers:
     - `upsertPart(part)` -> replace by id.
     - `appendPart(messageId, partId)` only on create.

2. **Normalize message storage**
   - Keep `messages.byId` and `messages.order`.
   - Attach parts to messages by `messageId`, not by synthetic bucket.

3. **Migration shim (temporary)**
   - If incoming parts are missing a stable id, generate a synthetic id once and reuse.
   - Keep legacy adapters for `data-*` parts until server emits stable ids.

Acceptance:

- Tool results update the same part id without appending.
- No duplicate parts for the same toolCallId.

### Phase 2 - Stream Routing: Single Message Strategy

Goal: remove preamble/activity/final split and route all parts to the server message id.

1. **Route by stream message id**
   - In `use-chat`, stop `ensurePreambleMessage/ensureActivityMessage/ensureFinalMessage`.
   - Use the stream message id (`message-start` or `text-delta` id) as the assistant message id.
   - If stream does not send `message-start`, use the id in `text-delta`.

2. **Attach tool parts to same assistant message**
   - `tool-call`, `tool-result`, `data-*` all update the same message.

3. **Buffer only for display (optional)**
   - If you want an intro bubble before tools, render a UI-only split at view time, not store time.

Acceptance:

- Text, tool calls, run cards, and final answer appear in correct chronological order.
- No cross-bubble updates.

### Phase 3 - Server Emission Cleanup

Goal: stop early planning emissions and align part ids.

1. **Mode transitions**
   - Do not emit `data-run` on `reasoning-start` by default.
   - Only emit `data-run` when explicitly in planning mode (not "reasoning happened").

2. **Stable part identifiers**
   - Ensure `data-action` id matches tool call id and remains stable across updates.
   - Ensure `data-run`/`data-run-group`/`data-run-item` ids are stable per run.

3. **Ordering**
   - Emit `data-mode-metadata` only once per mode transition.
   - Emit `data-action` before `tool-result` updates, but both with same id.

Acceptance:

- `data-run` appears only when planning is intended.
- Tool rows update in place.

### Phase 4 - UI Mode Routing Fixes

Goal: deterministic mode routing based on actual parts.

1. **Prioritize build over planning**
   - If tool parts exist, route to build regardless of run parts.
2. **Planning only when run card is authoritative**
   - Require `data-run` + explicit mode=planning and no tool parts.
3. **Metadata logic**
   - Support both `data-*` and `data-data-*` gracefully (normalize once).

Acceptance:

- No "always planning" state when tools are present.

### Phase 5 - Parser Robustness

Goal: prevent duplicate finish and inconsistent completion.

1. **Single finish guard**
   - Ensure `onComplete` fires once even if both `finish` and stream end happen.
2. **Tool input streaming**
   - Pass `tool-input-delta` to update tool args if needed.

Acceptance:

- No duplicate finalization; no double-buffer flush.

### Phase 6 - Server-Driven Sync + History Hydration

Goal: correct session history and stable state across sessions.

1. **Global sync layer**
   - Mirror opencode: event-driven updates for session, message, part.
2. **Session sync**
   - Load messages/parts on session selection (paginated).
3. **Persisted settings**
   - Persist chat mode, model, UI preferences.

Acceptance:

- Selecting an old session correctly populates chat history.
- History and streaming share the same store.

### Phase 7 - UI Presentation Cleanup

Goal: remove raw JSON and ensure markdown rendering.

1. **ActionRow formatting**
   - Format tool action subtitles (no raw JSON).
2. **Markdown rendering**
   - Ensure all text parts render as markdown consistently.

Acceptance:

- No raw JSON in UI.
- Markdown renders consistently.

### Phase 8 - Regression Tests (No Estimates)

Add automated tests and a manual trace checklist.

**Automated**

- Tool call/result update same row.
- Planning does not activate when tools exist.
- History hydration renders all messages.

**Manual trace**

- Run trace script and verify stream order and routing.
- Verify message/part ids in store match stream ids.

### Deliverables Checklist

- [ ] Store refactor to part-by-id updates.
- [ ] Stream routing by message id (no synthetic splits).
- [ ] Server mode gating and stable ids.
- [ ] UI mode routing precedence fixed.
- [ ] Parser single-finish guard.
- [ ] Global sync + session hydration.
- [ ] Presentation cleanup (no raw JSON, markdown correct).
- [ ] Test coverage for tool updates and planning/build routing.

**Problems**:

- History hydration absent.
- Tool update targets can drift (wrong message).
- Mode routing locked by `data-run`.

#### Desired (Server-Driven, Unified Updates)

```
Server (stream + history + events)
  ├─ message.updated
  ├─ message.part.updated
  └─ session/history
            │
            v
     GlobalSync Store (id-stable)
            │
     SessionSync Hydration
            │
     Unified Chat Store
   (messages + parts)
            │
            v
     UI mode router
```

**Benefits**:

- History and live stream converge in one path.
- Parts updated in-place by id (no duplicates).
- Mode routing based on actual message parts + metadata.

---

## 11) Known Mismatch Hypotheses (to Validate)

1. **`data-action` never reaches store**
   - If parser doesn’t emit `onDataPart` for `data-action`, build mode never triggers.
2. **`data-action` double prefix**
   - If type becomes `data-data-action`, metadata hooks in `use-chat` are skipped.
3. **Tool-call not emitted or lost**
   - If `tool-call` is missing in stream, tool results have no target to update.
4. **ToolCallId mismatch**
   - If toolCallId changes between call/result, updates are impossible.

---

## 12) Concrete File Checklist (Where to Focus)

### Server

- `packages/server/src/routes/chat.ts`
  - `detectMode()`
  - `data-run` / `data-run-group` emission
  - `data-action` updates on tool-result

### Client streaming

- `apps/desktop/src/lib/chat/stream-parser.ts`
- `apps/desktop/src/hooks/use-chat.ts`
- `apps/desktop/src/lib/chat/store.ts`

### UI rendering

- `apps/desktop/src/components/assistant-message.tsx`
- `apps/desktop/src/components/activity-feed/index.tsx`
- `apps/desktop/src/components/message-parts.tsx`
- `apps/desktop/src/components/run-card/index.tsx`

### Reference (opencode)

- `opencode/packages/opencode/src/session/message-v2.ts`
- `opencode/packages/opencode/src/session/processor.ts`
- `opencode/packages/web/src/components/Share.tsx`
- `opencode/packages/web/src/components/share/part.tsx`

---

## 13) Trace Template (for future logs)

Use this template to document a single request trace:

```
# Request: "<user prompt>"

[server] write: data-state id=state
[server] write: data-mode-metadata id=<messageId> mode=planning
[server] write: data-run id=<runId>
[server] write: data-run-group id=<groupId>
[server] write: data-thought id=<reasoningId>
[server] write: tool-call toolCallId=<tcId>
[server] write: data-action id=<tcId>
[server] write: tool-result toolCallId=<tcId>
[server] write: data-action id=<tcId>
[server] write: text-delta id=<messageId>
[server] write: finish

[parser] part: data-run id=<runId>
[use-chat] data-run → activityMessageId=msg_x
[use-chat] tool-call → activityMessageId=msg_x
[use-chat] tool-result → activityMessageId=msg_x
[use-chat] text-delta → preambleMessageId=msg_y

[store] message msg_x parts:
  - tool-call id=<tcId>
  - data-action id=<tcId>
  - ...
```

---

## 14) Summary

The architecture is close to opencode’s model, but the stream→message routing and mode detection are misaligned. The biggest risks are:

- **Early planning mode** from `reasoning-start`.
- **Part update mismatch** from `data-*` prefixing or toolCallId mismatch.
- **Message splitting** (preamble/activity/final) that makes ordering appear wrong.

This plan provides the exact files and steps needed to trace, confirm, and fix once you’re ready.
