# Chat Streaming Performance Remediation Plan

## 1. Objective

Eliminate UI lag and scroll lock during active chat streaming while preserving:

- chronological rendering of all parts (reasoning, tool calls/results, text),
- current Tailwind-based design language,
- data correctness and eventual consistency with canonical SSE events.

This plan targets the current architecture in `apps/desktop` first, and introduces server coalescing in `packages/server` only if needed after client fixes.

---

## 2. Confirmed Symptoms and Findings

### 2.1 User-facing symptoms

- Scrolling becomes unresponsive while stream is active.
- Chat feels laggy/janky during tool/reasoning-heavy runs.
- UI responsiveness degrades before completion.

### 2.2 Evidence from `fe-logs.txt`

- Total log lines: `22776`
- Hot-path log counts:
  - `[desktop:hooks:use-session-turns]`: `13544`
  - `[desktop:providers:app-provider]`: `2266`
  - `[event-router-adapter]`: `2269`
  - `[desktop:hooks:use-messages]`: `2257`
  - `[desktop:hooks:use-chat]`: `1017`
- Specific recurring lines:
  - `SSE event received`: `2263`
  - `Event processed successfully`: `2263`
  - `Built turns`: `9027`
  - `useSessionTurns cleanup`: `4514`
  - `Projecting messages`: `2256`
  - `Data part received`: `1014`
- Browser warns: `[Violation] 'setTimeout' handler took <N>ms` during stream bursts.

### 2.3 Probable technical root causes

1. Hot-path console logging flood in streaming/event loops.
2. Hook lifecycle misuse in JSX causing repeated hook disposal/recreation.
3. Dual update pipelines (local stream optimistic upserts + canonical SSE updates) amplifying reactive work.
4. Per-delta state writes at token-level granularity with expensive projections.
5. Full-turn projection/re-sorting and markdown/render work triggered too frequently.

---

## 3. Design Constraints and Non-Goals

### 3.1 Constraints

- Keep chronological part ordering behavior.
- Keep current visual styling approach and Tailwind usage.
- Do not regress permission/question/tool rendering semantics.
- Maintain session/event correctness and reconciliation guarantees.

### 3.2 Non-goals

- No broad UI redesign.
- No protocol breaking changes between server and desktop.
- No removal of reasoning/tool visibility.

---

## 4. Strategy Summary

1. Fix highest-impact client hot paths first (logging + hook lifecycle + stream write cadence).
2. Reduce duplicate work between local stream and SSE canonical path.
3. Optimize rendering/projection granularity.
4. Add optional server-side coalescing only if client-side improvements are insufficient.

---

## 5. Implementation Plan (Phased)

## Phase A: Baseline, Instrumentation, and Safety Nets

### A1. Add performance counters (dev-only)

Add a lightweight perf monitor module (desktop) tracking:

- stream events/sec,
- SSE events/sec,
- part/message upserts/sec,
- turn projection duration (p50/p95),
- queue depth and drops (if coalescing active),
- scroll handler latency samples.

### A2. Fixture-driven reproducible stress scenarios

Create/extend fixtures in `apps/desktop/tests/fixtures/` with realistic streamed data:

- long reasoning token burst,
- interleaved tool call/result cycles,
- final assistant text completion,
- high event-rate session with hundreds/thousands of `message.part.updated`.

### A3. Add performance-sensitive tests

Add integration/unit tests to assert:

- chronological ordering remains correct under burst updates,
- projection count is bounded relative to input event count,
- no duplicate part inflation from dual pipelines,
- scrolling remains logically possible during stream (behavioral proxy checks).

---

## Phase B: Immediate Hot-Path Relief (Low Risk, High Gain)

### B1. Gate or remove hot-loop debug logs

In these modules, convert per-event debug logging to sampled/aggregated logs:

- `apps/desktop/src/core/state/providers/app-provider.tsx`
- `apps/desktop/src/core/chat/domain/event-router-adapter.ts`
- `apps/desktop/src/core/chat/hooks/use-messages.ts`
- `apps/desktop/src/core/chat/hooks/use-session-turns.ts`
- `apps/desktop/src/core/chat/hooks/use-chat.ts`

Guideline:

- keep `warn/error` always,
- keep `info` only for lifecycle boundaries,
- for debug, emit one aggregate summary per 1s window (not per event).

### B2. Validate log-volume reduction

Acceptance target:

- > =90% reduction in log lines during the same stress stream.

---

## Phase C: Reactive Lifecycle Fixes

### C1. Fix hook invocation placement

Current risky pattern:

- `turns={useSessionTurns(effectiveSessionId)}` inline in JSX.

Fix:

- call `const turns = useSessionTurns(effectiveSessionId);` once at component top scope,
- pass `turns={turns}` into `MessageTimeline`.

### C2. Verify disposal churn is eliminated

Acceptance target:

- `useSessionTurns cleanup` appears only on unmount/session switch, not per streamed event.

---

## Phase D: Coalesce Client Stream Writes to Frame Cadence

### D1. Introduce client-side stream write coalescer

For the local fetch stream path (`use-chat` callbacks):

- buffer frequent `text-delta` and `data-thought` updates by entity key,
- flush at `requestAnimationFrame` or fixed ~16ms cadence,
- preserve order for tool lifecycle transitions (`tool-call`, `tool-result`, `finish`).

### D2. Apply batched store updates

- perform grouped `partActions.upsert` in batches per flush cycle,
- avoid multiple writes for same part within same frame (last update wins for text/reasoning).

### D3. Ensure final flush guarantees

On complete/error/abort:

- flush pending buffers synchronously before final state transitions,
- avoid dropped terminal text/tool states.

---

## Phase E: Reduce Duplicate Work Between Local Stream and SSE

### E1. Define source-of-truth policy during active local request

Recommended policy:

- local stream drives immediate optimistic UI,
- SSE canonical updates reconcile and finalize, with dedupe guards to avoid duplicate upserts.

### E2. Add dedupe guards

Use stable keys + metadata:

- `(sessionID, messageID, partID/callID, sequence/timestamp window)`,
- skip canonical apply if update is equivalent to already-applied optimistic state.

### E3. Keep correctness paths intact

- keep orphan cleanup and reconciliation safety for reconnect/out-of-order scenarios.

---

## Phase F: Projection and Render Cost Optimization

### F1. Incremental projection where possible

Optimize turn building:

- avoid rebuilding every turn on every tiny part update,
- update only affected message/turn segments when feasible.

### F2. Streaming markdown/render policy

For streaming text/reasoning:

- render lightweight/plain representation during high-frequency streaming,
- run full markdown transform on settle or completion (or coarse throttle).

### F3. Auto-scroll behavior hardening

Review `create-auto-scroll`:

- reduce timer polling frequency/complexity,
- ensure scroll handler remains cheap and non-blocking during bursts.

---

## Phase G (Conditional): Server-side Coalescing

Apply only if Phase B-F still does not meet responsiveness target.

### G1. Server coalescing scope

In `packages/server/src/routes/chat.ts`, coalesce high-frequency stream emits:

- `text` and `reasoning-delta` events per part at ~16ms windows,
- preserve immediate emission for structural events:
  - tool-call start/result,
  - finish/error/session status transitions.

### G2. Coalescing invariants

- no reordering across semantic boundaries,
- forced flush on finish/error/abort,
- maintain eventual full content fidelity.

### G3. Disadvantages to track explicitly

- less granular intermediate “typing” fidelity,
- higher server complexity/state management,
- potential debugging mismatch vs raw agent emission,
- affects all clients globally (not only slow ones).

---

## 6. TDD Execution Order

1. Write failing tests for:

- hook lifecycle stability,
- client coalescer ordering and flush guarantees,
- dual-pipeline dedupe behavior,
- chronological rendering under burst streams.

2. Implement Phase B (logging), re-run tests.
3. Implement Phase C (hook lifecycle), re-run tests.
4. Implement Phase D (client coalescing), re-run tests.
5. Implement Phase E/F optimizations, re-run tests.
6. Only then decide on Phase G with measurable evidence.

---

## 7. Acceptance Criteria

## Functional

- Parts render in strict chronological order.
- Tool/reasoning/text stream visibility preserved.
- No stuck “working” state after completion.

## Performance

- Smooth scrolling while stream is active (no perceived scroll lock).
- Significant reduction in main-thread warning frequency.
- Event-to-render latency stable under high stream rate.
- Log volume in dev reduced by >=90% for same scenario.

## Regression

- Existing chat parity tests remain passing.
- New fixture-driven streaming tests pass.
- Typecheck and lint pass across affected packages.

---

## 8. Validation Checklist

Run before merge:

1. `pnpm --dir apps/desktop test`
2. `pnpm --dir apps/desktop typecheck`
3. `pnpm --dir apps/desktop lint`
4. `pnpm --dir packages/server test` (if server modified)
5. `pnpm --dir packages/server typecheck` (if server modified)
6. `pnpm --dir packages/server lint` (if server modified)

Manual validation:

1. start long reasoning + tool-heavy prompt,
2. continuously scroll during stream,
3. confirm ordered parts appear as generated,
4. confirm no freeze/jank spikes.

---

## 9. Rollout Plan

1. Ship Phase B+C first (safe/high ROI).
2. Measure with same workload and logs.
3. Ship Phase D+E+F.
4. Re-measure.
5. Enable Phase G only if client-target metrics are still not met.

---

## 10. File Targets (Expected)

Likely touched client files:

- `apps/desktop/src/views/workspace-view/index.tsx`
- `apps/desktop/src/core/chat/hooks/use-chat.ts`
- `apps/desktop/src/core/chat/hooks/use-session-turns.ts`
- `apps/desktop/src/core/chat/hooks/use-messages.ts`
- `apps/desktop/src/core/state/providers/app-provider.tsx`
- `apps/desktop/src/core/chat/domain/event-router-adapter.ts`
- `apps/desktop/src/core/shared/utils/create-auto-scroll.ts`
- `apps/desktop/src/views/workspace-view/chat-area/session-turn.tsx`
- tests/fixtures under `apps/desktop/tests/fixtures/`

Potential server file if needed:

- `packages/server/src/routes/chat.ts`
