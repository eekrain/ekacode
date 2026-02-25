# Background Task Run Execution (Server-Owned) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement true background task execution so runs continue when desktop UI unmounts, navigates away, disconnects, or reconnects, while preserving deterministic event replay and corruption-safe reconciliation.

**Architecture:** Introduce durable `task_session_runs` + `task_run_events` persistence with a server-owned worker lifecycle. Convert UI from request-owned stream assumption to snapshot-plus-catchup projection using monotonic cursors and idempotent reducers. Keep existing `/api/chat` behavior available during migration, while adding explicit run control APIs and background execution path.

**Tech Stack:** TypeScript monorepo, pnpm, Hono, Drizzle ORM (SQLite/libsql), Vitest, SolidJS/Electron desktop, SSE event transport, existing event ordering/dedup utilities.

---

## Skill and Process Requirements

- `@superpowers/writing-plans` is the governing process for this document.
- `@superpowers/test-driven-development` is mandatory for every implementation task in this plan.
- `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST` applies to every task.
- Each task below is written in explicit RED -> GREEN -> REFACTOR style with frequent commits.

---

## Grounded Context (Validated Against Current Code)

### Current server realities

1. Chat execution is request-coupled in [`packages/server/src/routes/chat.ts`](../../packages/server/src/routes/chat.ts).
2. Session controllers exist and support abort via [`packages/core/src/session/controller.ts`](../../packages/core/src/session/controller.ts).
3. Session manager is in-memory singleton in [`packages/server/src/runtime.ts`](../../packages/server/src/runtime.ts).
4. Task session persistence exists in [`packages/server/db/task-sessions.ts`](../../packages/server/db/task-sessions.ts).
5. Event persistence/catch-up already exists for session events in [`packages/server/db/schema.ts`](../../packages/server/db/schema.ts) (`events` table) and [`packages/server/src/routes/events.ts`](../../packages/server/src/routes/events.ts).
6. Global SSE endpoint streams bus events from [`packages/server/src/routes/event.ts`](../../packages/server/src/routes/event.ts).

### Current desktop realities

1. Chat request lifecycle currently aborts on unmount/stop in [`apps/desktop/src/core/chat/hooks/use-chat.ts`](../../apps/desktop/src/core/chat/hooks/use-chat.ts).
2. Task switching currently remounts `WorkspaceChatProvider` via [`apps/desktop/src/views/workspace-view/index.tsx`](../../apps/desktop/src/views/workspace-view/index.tsx).
3. Task sessions are hydrated via [`apps/desktop/src/core/state/providers/workspace-provider.tsx`](../../apps/desktop/src/core/state/providers/workspace-provider.tsx).
4. Event ordering and dedupe logic already exists in [`apps/desktop/src/core/chat/domain/event-router-adapter.ts`](../../apps/desktop/src/core/chat/domain/event-router-adapter.ts).
5. Reconnect/catch-up test patterns already exist under `apps/desktop/tests/integration/reconnect-catchup-rendering.test.tsx`.

### Migration constraints

1. Append-only migration policy is enforced by `scripts/check-server-migration-policy.mjs`.
2. Do not edit/remove previous migrations; only add new SQL/snapshot and journal entry.
3. Keep backward compatibility for current `/api/chat` until migration cutover step.

---

## Scope and Non-Goals

## In Scope

1. Add durable run entity (`task_session_runs`) and durable run event log (`task_run_events`).
2. Add server APIs for starting/listing/querying/canceling runs and replaying run events.
3. Add worker loop for claim/execute/heartbeat/recovery semantics.
4. Add desktop snapshot + catch-up + live subscription flow per task session/run.
5. Add anti-corruption invariants and full-rehydrate fallback path.
6. Add comprehensive TDD coverage across db/routes/worker/desktop integration.

## Out of Scope

1. Introducing Redis/BullMQ in this phase.
2. Multi-node distributed worker election.
3. Removing existing `/api/chat` endpoints entirely in the first delivery.
4. Replacing current bus/event framework wholesale.

---

## Design Decisions (Concrete)

1. **Execution ownership**: Server worker owns run lifecycle; HTTP request only creates/observes runs.
2. **Run idempotency**: Enforce `(task_session_id, client_request_key)` uniqueness.
3. **State model**: `queued`, `running`, `cancel_requested`, `completed`, `failed`, `canceled`, `stale`, `dead`.
4. **Lease model**: DB-based lease fields (`lease_owner`, `lease_expires_at`, `last_heartbeat_at`) with sweeper.
5. **Event ordering**: Monotonic integer `event_seq` per run plus globally unique `event_id` (UUIDv7) for dedupe.
6. **Desktop reconciliation**: Snapshot cursor boundary + replay `>` cursor + idempotent reducer apply.
7. **Fallback safety**: Any invariant breach triggers full rehydrate for affected run/session.
8. **Incremental rollout**: Feature flag `SAKTI_CODE_BACKGROUND_RUNS_ENABLED` for controlled adoption.

---

## New/Modified Artifacts Summary

### New server DB artifacts

1. `packages/server/drizzle/0007_background_task_runs.sql`
2. `packages/server/drizzle/meta/0007_snapshot.json`
3. `packages/server/db/task-session-runs.ts`
4. `packages/server/db/task-run-events.ts`
5. `packages/server/db/__tests__/task-session-runs.test.ts`
6. `packages/server/db/__tests__/task-run-events.test.ts`
7. `packages/server/db/__tests__/task-run-recovery.test.ts`

### Modified server artifacts

1. `packages/server/db/schema.ts`
2. `packages/server/db/index.ts`
3. `packages/server/src/bus/index.ts`
4. `packages/server/src/index.ts`
5. `packages/server/src/runtime.ts`
6. `packages/server/src/routes/chat.ts`
7. `packages/server/src/routes/task-sessions.ts`
8. `packages/server/src/routes/events.ts`
9. `packages/server/src/routes/__tests__/chat-runtime-mode.test.ts`
10. `packages/server/src/routes/__tests__/event.test.ts`
11. `packages/server/src/routes/__tests__/task-sessions.test.ts`

### New server route/service artifacts

1. `packages/server/src/routes/task-runs.ts`
2. `packages/server/src/routes/run-events.ts`
3. `packages/server/src/routes/__tests__/task-runs.test.ts`
4. `packages/server/src/routes/__tests__/run-events.test.ts`
5. `packages/server/src/services/task-run-worker.ts`
6. `packages/server/src/services/task-run-recovery.ts`
7. `packages/server/src/services/__tests__/task-run-worker.test.ts`
8. `packages/server/src/services/__tests__/task-run-recovery.test.ts`

### New/modified desktop artifacts

1. `apps/desktop/src/core/services/api/api-client.ts`
2. `apps/desktop/src/core/services/api/__tests__/api-client-task-runs.test.ts`
3. `apps/desktop/src/core/state/stores/run-store.ts`
4. `apps/desktop/src/core/state/providers/store-provider.tsx`
5. `apps/desktop/src/core/chat/domain/event-router-adapter.ts`
6. `apps/desktop/src/core/chat/hooks/use-chat.ts`
7. `apps/desktop/src/core/chat/hooks/use-run-events.ts`
8. `apps/desktop/src/core/state/providers/workspace-provider.tsx`
9. `apps/desktop/src/views/workspace-view/index.tsx`
10. `apps/desktop/tests/integration/task-switch-background-run-catchup.test.tsx`
11. `apps/desktop/tests/integration/reconnect-catchup-rendering.test.tsx`

### Documentation artifacts

1. `docs/TASK_FIRST_WORKFLOW.md`
2. `docs/architecture/background-task-runs.md`
3. `docs/ops/background-run-recovery-runbook.md`

---

## Global Verification Matrix (Run Frequently)

### Server

1. `pnpm --filter @sakti-code/server lint`
2. `pnpm --filter @sakti-code/server typecheck`
3. `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs.test.ts`
4. `pnpm --filter @sakti-code/server test db/__tests__/task-run-events.test.ts`
5. `pnpm --filter @sakti-code/server test src/routes/__tests__/task-runs.test.ts`
6. `pnpm --filter @sakti-code/server test src/routes/__tests__/run-events.test.ts`
7. `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-worker.test.ts`
8. `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-recovery.test.ts`
9. `pnpm migrations:check:server`

### Desktop

1. `pnpm --filter @sakti-code/desktop lint`
2. `pnpm --filter @sakti-code/desktop typecheck`
3. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-ui-jsdom src/core/services/api/__tests__/api-client-task-runs.test.ts`
4. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/task-switch-background-run-catchup.test.tsx`
5. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/reconnect-catchup-rendering.test.tsx`

---

## Task Plan (TDD, Frequent Commits)

### Task 1: Add failing server schema tests for run tables

**Files:**

- Create: `packages/server/db/__tests__/task-session-runs-schema.test.ts`
- Create: `packages/server/db/__tests__/task-run-events-schema.test.ts`
- Modify: `packages/server/db/__tests__/index.test.ts`

**Step 1: Write the failing tests (RED)**

```ts
import { describe, expect, it } from "vitest";
import { taskSessionRuns, taskRunEvents } from "../../db/schema";

describe("task_session_runs schema", () => {
  it("exposes run state/lease/idempotency columns", () => {
    expect(taskSessionRuns).toBeDefined();
    expect(taskSessionRuns.run_id).toBeDefined();
    expect(taskSessionRuns.task_session_id).toBeDefined();
    expect(taskSessionRuns.state).toBeDefined();
    expect(taskSessionRuns.client_request_key).toBeDefined();
    expect(taskSessionRuns.lease_owner).toBeDefined();
    expect(taskSessionRuns.lease_expires_at).toBeDefined();
    expect(taskSessionRuns.last_heartbeat_at).toBeDefined();
  });
});

describe("task_run_events schema", () => {
  it("exposes run event ordering columns", () => {
    expect(taskRunEvents).toBeDefined();
    expect(taskRunEvents.event_id).toBeDefined();
    expect(taskRunEvents.run_id).toBeDefined();
    expect(taskRunEvents.task_session_id).toBeDefined();
    expect(taskRunEvents.event_seq).toBeDefined();
    expect(taskRunEvents.event_type).toBeDefined();
    expect(taskRunEvents.payload).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs-schema.test.ts db/__tests__/task-run-events-schema.test.ts`
Expected: FAIL because `taskSessionRuns` and `taskRunEvents` are not exported from schema yet.

**Step 3: Implement minimal schema exports (GREEN)**

```ts
// placeholder exports in schema.ts to satisfy compile first
export const taskSessionRuns = sqliteTable("task_session_runs", {
  run_id: text("run_id").primaryKey(),
  task_session_id: text("task_session_id").notNull(),
  state: text("state").notNull(),
  client_request_key: text("client_request_key"),
  lease_owner: text("lease_owner"),
  lease_expires_at: integer("lease_expires_at", { mode: "timestamp" }),
  last_heartbeat_at: integer("last_heartbeat_at", { mode: "timestamp" }),
});

export const taskRunEvents = sqliteTable("task_run_events", {
  event_id: text("event_id").primaryKey(),
  run_id: text("run_id").notNull(),
  task_session_id: text("task_session_id").notNull(),
  event_seq: integer("event_seq").notNull(),
  event_type: text("event_type").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
});
```

**Step 4: Run test to verify pass**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs-schema.test.ts db/__tests__/task-run-events-schema.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/db/__tests__/task-session-runs-schema.test.ts \
  packages/server/db/__tests__/task-run-events-schema.test.ts \
  packages/server/db/__tests__/index.test.ts \
  packages/server/db/schema.ts
git commit -m "test(server): add failing schema coverage for background run tables"
```

---

### Task 2: Add failing DB behavior tests for run lifecycle

**Files:**

- Create: `packages/server/db/__tests__/task-session-runs.test.ts`

**Step 1: Write failing tests (RED)**

```ts
import { describe, expect, it } from "vitest";
import {
  createTaskSessionRun,
  claimNextTaskSessionRun,
  heartbeatTaskSessionRun,
  markTaskSessionRunCompleted,
  requestTaskSessionRunCancel,
  markTaskSessionRunCanceled,
  getTaskSessionRunById,
} from "../../db/task-session-runs";

describe("task-session-runs db", () => {
  it("creates queued run with idempotency key", async () => {
    const run = await createTaskSessionRun({
      taskSessionId: "019c0000-0000-7000-8000-000000000001",
      runtimeMode: "plan",
      clientRequestKey: "req-1",
      input: { message: "hello" },
    });
    expect(run.state).toBe("queued");
    expect(run.clientRequestKey).toBe("req-1");
  });

  it("claims queued run with lease owner and expiry", async () => {
    await createTaskSessionRun({
      taskSessionId: "019c0000-0000-7000-8000-000000000002",
      runtimeMode: "build",
      clientRequestKey: "req-2",
      input: { message: "build" },
    });

    const claimed = await claimNextTaskSessionRun({ workerId: "worker-A", leaseMs: 30000 });
    expect(claimed).not.toBeNull();
    expect(claimed?.state).toBe("running");
    expect(claimed?.leaseOwner).toBe("worker-A");
  });

  it("heartbeats running run", async () => {
    const run = await createTaskSessionRun({
      taskSessionId: "019c0000-0000-7000-8000-000000000003",
      runtimeMode: "build",
      clientRequestKey: "req-3",
      input: { message: "hb" },
    });
    const claimed = await claimNextTaskSessionRun({ workerId: "worker-A", leaseMs: 1000 });
    expect(claimed?.runId).toBe(run.runId);

    await heartbeatTaskSessionRun({ runId: run.runId, workerId: "worker-A", leaseMs: 1000 });
    const refreshed = await getTaskSessionRunById(run.runId);
    expect(refreshed?.lastHeartbeatAt).toBeDefined();
  });

  it("supports cancel request then canceled terminal state", async () => {
    const run = await createTaskSessionRun({
      taskSessionId: "019c0000-0000-7000-8000-000000000004",
      runtimeMode: "plan",
      clientRequestKey: "req-4",
      input: { message: "cancel" },
    });

    await requestTaskSessionRunCancel(run.runId);
    const afterRequest = await getTaskSessionRunById(run.runId);
    expect(afterRequest?.state).toBe("cancel_requested");

    await markTaskSessionRunCanceled({ runId: run.runId, workerId: "worker-A" });
    const canceled = await getTaskSessionRunById(run.runId);
    expect(canceled?.state).toBe("canceled");
  });

  it("marks completed terminal state", async () => {
    const run = await createTaskSessionRun({
      taskSessionId: "019c0000-0000-7000-8000-000000000005",
      runtimeMode: "build",
      clientRequestKey: "req-5",
      input: { message: "done" },
    });
    await claimNextTaskSessionRun({ workerId: "worker-A", leaseMs: 30000 });
    await markTaskSessionRunCompleted({ runId: run.runId, workerId: "worker-A" });

    const completed = await getTaskSessionRunById(run.runId);
    expect(completed?.state).toBe("completed");
    expect(completed?.finishedAt).toBeDefined();
  });
});
```

**Step 2: Run test to verify fail**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs.test.ts`
Expected: FAIL because db module does not exist.

**Step 3: Implement minimal db module stubs (GREEN)**

```ts
// packages/server/db/task-session-runs.ts
export async function createTaskSessionRun() {
  throw new Error("not implemented");
}
// add all named exports with minimal structure to compile,
// then implement incrementally until tests pass.
```

**Step 4: Run test to pass**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs.test.ts`
Expected: PASS after real implementation (not stubs).

**Step 5: Commit**

```bash
git add packages/server/db/__tests__/task-session-runs.test.ts \
  packages/server/db/task-session-runs.ts
git commit -m "test(server): define task run db lifecycle behavior"
```

---

### Task 3: Add failing DB behavior tests for run events append/replay

**Files:**

- Create: `packages/server/db/__tests__/task-run-events.test.ts`
- Create: `packages/server/db/task-run-events.ts`

**Step 1: Write failing tests (RED)**

```ts
import { describe, expect, it } from "vitest";
import {
  appendTaskRunEvent,
  listTaskRunEventsAfter,
  getLastTaskRunEventSeq,
} from "../../db/task-run-events";

describe("task-run-events db", () => {
  it("appends monotonic event_seq for run", async () => {
    const e1 = await appendTaskRunEvent({
      runId: "run-1",
      taskSessionId: "session-1",
      eventType: "task-run.updated",
      payload: { state: "running" },
    });
    const e2 = await appendTaskRunEvent({
      runId: "run-1",
      taskSessionId: "session-1",
      eventType: "message.part.updated",
      payload: { text: "delta" },
    });

    expect(e1.eventSeq).toBe(1);
    expect(e2.eventSeq).toBe(2);
  });

  it("lists events strictly after cursor", async () => {
    await appendTaskRunEvent({
      runId: "run-2",
      taskSessionId: "session-2",
      eventType: "a",
      payload: { n: 1 },
    });
    await appendTaskRunEvent({
      runId: "run-2",
      taskSessionId: "session-2",
      eventType: "b",
      payload: { n: 2 },
    });
    await appendTaskRunEvent({
      runId: "run-2",
      taskSessionId: "session-2",
      eventType: "c",
      payload: { n: 3 },
    });

    const items = await listTaskRunEventsAfter({ runId: "run-2", afterEventSeq: 1, limit: 10 });
    expect(items.map(i => i.eventType)).toEqual(["b", "c"]);
  });

  it("returns last sequence for run", async () => {
    await appendTaskRunEvent({
      runId: "run-3",
      taskSessionId: "session-3",
      eventType: "a",
      payload: {},
    });
    await appendTaskRunEvent({
      runId: "run-3",
      taskSessionId: "session-3",
      eventType: "b",
      payload: {},
    });
    const seq = await getLastTaskRunEventSeq("run-3");
    expect(seq).toBe(2);
  });
});
```

**Step 2: Run test to verify fail**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-run-events.test.ts`
Expected: FAIL because module and table behavior do not exist.

**Step 3: Implement minimal append/replay db module (GREEN)**

```ts
// packages/server/db/task-run-events.ts
// implement:
// - appendTaskRunEvent()
// - listTaskRunEventsAfter()
// - getLastTaskRunEventSeq()
// using taskRunEvents table and per-run max(event_seq)+1
```

**Step 4: Run test to pass**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-run-events.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/db/__tests__/task-run-events.test.ts \
  packages/server/db/task-run-events.ts
git commit -m "test(server): define task run event append and replay behavior"
```

---

### Task 4: Add failing migration test assertions and create migration files

**Files:**

- Create: `packages/server/drizzle/0007_background_task_runs.sql`
- Create: `packages/server/drizzle/meta/0007_snapshot.json`
- Modify: `packages/server/drizzle/meta/_journal.json`
- Modify: `packages/server/db/schema.ts`

**Step 1: Write failing schema integration tests (RED)**

```ts
import { describe, expect, it } from "vitest";
import { db } from "../../db";

describe("background run migration", () => {
  it("creates task_session_runs table", async () => {
    const rows = await db.run(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='task_session_runs'`
    );
    expect(rows).toBeDefined();
  });

  it("creates task_run_events table", async () => {
    const rows = await db.run(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='task_run_events'`
    );
    expect(rows).toBeDefined();
  });
});
```

**Step 2: Run test to verify fail**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs-schema.test.ts`
Expected: FAIL until migration/schema align.

**Step 3: Implement migration and schema (GREEN)**

```sql
CREATE TABLE `task_session_runs` (
  `run_id` text PRIMARY KEY NOT NULL,
  `task_session_id` text NOT NULL,
  `runtime_mode` text NOT NULL,
  `state` text NOT NULL,
  `client_request_key` text,
  `input` text,
  `attempt` integer NOT NULL DEFAULT 0,
  `max_attempts` integer NOT NULL DEFAULT 3,
  `lease_owner` text,
  `lease_expires_at` integer,
  `last_heartbeat_at` integer,
  `cancel_requested_at` integer,
  `started_at` integer,
  `finished_at` integer,
  `error` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`task_session_id`) REFERENCES `task_sessions`(`session_id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `task_session_runs_session_request_key_idx`
  ON `task_session_runs` (`task_session_id`,`client_request_key`);

CREATE INDEX `task_session_runs_state_idx` ON `task_session_runs` (`state`);
CREATE INDEX `task_session_runs_lease_idx` ON `task_session_runs` (`state`,`lease_expires_at`);

CREATE TABLE `task_run_events` (
  `event_id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `task_session_id` text NOT NULL,
  `event_seq` integer NOT NULL,
  `event_type` text NOT NULL,
  `payload` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`run_id`) REFERENCES `task_session_runs`(`run_id`) ON DELETE cascade,
  FOREIGN KEY (`task_session_id`) REFERENCES `task_sessions`(`session_id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `task_run_events_run_seq_idx` ON `task_run_events` (`run_id`,`event_seq`);
CREATE INDEX `task_run_events_run_created_idx` ON `task_run_events` (`run_id`,`created_at`);
CREATE INDEX `task_run_events_session_created_idx` ON `task_run_events` (`task_session_id`,`created_at`);
```

**Step 4: Run migration checks + tests**

Run:

1. `pnpm --filter @sakti-code/server drizzle:check`
2. `pnpm migrations:check:server`
3. `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs-schema.test.ts db/__tests__/task-run-events-schema.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/drizzle/0007_background_task_runs.sql \
  packages/server/drizzle/meta/0007_snapshot.json \
  packages/server/drizzle/meta/_journal.json \
  packages/server/db/schema.ts
git commit -m "feat(server): add durable task run and run event schema"
```

---

### Task 5: Add failing server route contract tests for task run APIs

**Files:**

- Create: `packages/server/src/routes/__tests__/task-runs.test.ts`
- Create: `packages/server/src/routes/__tests__/run-events.test.ts`

**Step 1: Write failing route tests (RED)**

```ts
import { describe, expect, it } from "vitest";
import app from "../../index";

describe("task-runs routes", () => {
  it("POST /api/task-sessions/:id/runs creates queued run", async () => {
    const res = await app.request("/api/task-sessions/019c0000-0000-7000-8000-000000000101/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic ..." },
      body: JSON.stringify({
        runtimeMode: "plan",
        input: { message: "plan this" },
        clientRequestKey: "key-1",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.run.state).toBe("queued");
  });

  it("POST with same clientRequestKey is idempotent", async () => {
    const path = "/api/task-sessions/019c0000-0000-7000-8000-000000000102/runs";
    const body = JSON.stringify({
      runtimeMode: "plan",
      input: { message: "same" },
      clientRequestKey: "dup-key",
    });
    const r1 = await app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic ..." },
      body,
    });
    const r2 = await app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic ..." },
      body,
    });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(200);
    const d1 = await r1.json();
    const d2 = await r2.json();
    expect(d2.run.runId).toBe(d1.run.runId);
  });

  it("POST cancel sets cancel_requested", async () => {
    // create then cancel
  });

  it("GET run-events after cursor returns strictly newer events", async () => {
    // append then query afterEventSeq
  });
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-runs.test.ts src/routes/__tests__/run-events.test.ts`
Expected: FAIL because routes do not exist.

**Step 3: Add minimal route files and mount paths (GREEN)**

```ts
// create task-runs route file with minimal handlers returning TODO
// create run-events route file with minimal validation and empty payload
// mount in server index for route discovery
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-runs.test.ts src/routes/__tests__/run-events.test.ts`
Expected: PASS with real handlers.

**Step 5: Commit**

```bash
git add packages/server/src/routes/__tests__/task-runs.test.ts \
  packages/server/src/routes/__tests__/run-events.test.ts \
  packages/server/src/routes/task-runs.ts \
  packages/server/src/routes/run-events.ts \
  packages/server/src/index.ts
git commit -m "test(server): define task run route contracts"
```

---

### Task 6: Add failing worker lifecycle tests (claim/heartbeat/recovery/cancel)

**Files:**

- Create: `packages/server/src/services/__tests__/task-run-worker.test.ts`
- Create: `packages/server/src/services/__tests__/task-run-recovery.test.ts`

**Step 1: Write failing tests (RED)**

```ts
import { describe, expect, it, vi } from "vitest";
import { createTaskRunWorker } from "../task-run-worker";

vi.mock("../../runtime", () => ({
  getSessionManager: () => ({
    getSession: vi.fn(),
    createSession: vi.fn(),
  }),
}));

describe("task-run-worker", () => {
  it("claims queued runs and marks running", async () => {
    const worker = createTaskRunWorker({ workerId: "worker-test", pollIntervalMs: 10 });
    await worker.tickOnce();
    // assert claim was attempted and state transitions happened
  });

  it("emits heartbeat while running", async () => {
    const worker = createTaskRunWorker({ workerId: "worker-test", pollIntervalMs: 10 });
    await worker.tickOnce();
    // assert heartbeat call and updated lease
  });

  it("honors cancel_requested and marks canceled", async () => {
    // assert cooperative cancel check path
  });
});

describe("task-run-recovery", () => {
  it("marks expired leases stale and requeues", async () => {
    // seed expired run and sweep
  });

  it("moves over-retried stale run to dead", async () => {
    // attempt >= max_attempts path
  });
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-worker.test.ts src/services/__tests__/task-run-recovery.test.ts`
Expected: FAIL because services do not exist.

**Step 3: Implement minimal worker and recovery services (GREEN)**

```ts
// task-run-worker.ts
// - tickOnce()
// - start()/stop()
// - claim run
// - set running
// - execute with controller.processMessage
// - write run events
// - heartbeat
// - handle cancel_requested

// task-run-recovery.ts
// - sweepExpiredLeases(now)
// - stale -> queued/ dead according to attempt/max
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-worker.test.ts src/services/__tests__/task-run-recovery.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/services/__tests__/task-run-worker.test.ts \
  packages/server/src/services/__tests__/task-run-recovery.test.ts \
  packages/server/src/services/task-run-worker.ts \
  packages/server/src/services/task-run-recovery.ts
git commit -m "test(server): define background worker and recovery behavior"
```

---

### Task 7: Implement full `task-session-runs` DB module

**Files:**

- Modify: `packages/server/db/task-session-runs.ts`
- Modify: `packages/server/db/index.ts`

**Step 1: Add additional failing edge-case tests (RED)**

```ts
it("rejects claim when lease owned by different worker", async () => {
  // create running run with worker-A lease
  // worker-B attempts complete -> expect throw
});

it("returns existing run for duplicate idempotency key", async () => {
  // create twice with same key -> same runId
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs.test.ts`
Expected: FAIL for new edge cases.

**Step 3: Implement full module methods (GREEN)**

```ts
export async function createTaskSessionRun(input: {
  taskSessionId: string;
  runtimeMode: "intake" | "plan" | "build";
  clientRequestKey: string;
  input: Record<string, unknown>;
}) {
  /* insert + idempotency lookup */
}

export async function claimNextTaskSessionRun(params: { workerId: string; leaseMs: number }) {
  /* transaction-style claim queued/stale run */
}

export async function heartbeatTaskSessionRun(params: {
  runId: string;
  workerId: string;
  leaseMs: number;
}) {
  /* update heartbeat + lease */
}

export async function requestTaskSessionRunCancel(runId: string) {
  /* queued->canceled OR running->cancel_requested */
}

export async function markTaskSessionRunCompleted(params: { runId: string; workerId: string }) {}
export async function markTaskSessionRunFailed(params: {
  runId: string;
  workerId: string;
  error: string;
}) {}
export async function markTaskSessionRunCanceled(params: { runId: string; workerId: string }) {}

export async function listTaskSessionRuns(taskSessionId: string, options?: { limit?: number }) {}
export async function getTaskSessionRunById(runId: string) {}
export async function listExpiredLeasedRuns(now: Date) {}
export async function requeueStaleRun(runId: string) {}
export async function markDeadRun(runId: string, reason: string) {}
```

**Step 4: Run tests to pass + typecheck**

Run:

1. `pnpm --filter @sakti-code/server test db/__tests__/task-session-runs.test.ts`
2. `pnpm --filter @sakti-code/server typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/db/task-session-runs.ts packages/server/db/index.ts \
  packages/server/db/__tests__/task-session-runs.test.ts
git commit -m "feat(server): implement durable task run state persistence"
```

---

### Task 8: Implement full `task-run-events` DB module

**Files:**

- Modify: `packages/server/db/task-run-events.ts`

**Step 1: Add failing tests for dedupe + pagination windows (RED)**

```ts
it("enforces unique run_id + event_seq", async () => {
  // append same seq manually path should fail
});

it("supports pagination boundaries", async () => {
  // append 30 events and read in pages of 10
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-run-events.test.ts`
Expected: FAIL for new pagination/dedupe semantics.

**Step 3: Implement robust append/list API (GREEN)**

```ts
export async function appendTaskRunEvent(input: {
  runId: string;
  taskSessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  // read max seq
  // insert seq+1 with uuidv7 event_id
}

export async function listTaskRunEventsAfter(input: {
  runId: string;
  afterEventSeq: number;
  limit: number;
}) {
  // ordered asc by event_seq
}

export async function listTaskSessionRunEventsAfter(input: {
  taskSessionId: string;
  afterCreatedAtMs?: number;
  limit: number;
}) {}
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test db/__tests__/task-run-events.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/db/task-run-events.ts \
  packages/server/db/__tests__/task-run-events.test.ts
git commit -m "feat(server): implement task run event append and replay storage"
```

---

### Task 9: Add bus event definitions for run lifecycle

**Files:**

- Modify: `packages/server/src/bus/index.ts`
- Modify: `packages/shared/src/event-types.ts`
- Modify: `packages/shared/src/event-guards.ts`

**Step 1: Add failing tests for new bus event schemas (RED)**

```ts
import { describe, expect, it } from "vitest";
import { TaskRunUpdated, TaskRunCompleted } from "../../bus";

describe("run events", () => {
  it("validates task-run.updated payload", () => {
    const parsed = TaskRunUpdated.properties.parse({
      runId: "run-1",
      taskSessionId: "session-1",
      state: "running",
      runtimeMode: "plan",
      eventSeq: 10,
    });
    expect(parsed.state).toBe("running");
  });
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/bus/__tests__/task-events.test.ts`
Expected: FAIL because run event defs missing.

**Step 3: Implement event defs (GREEN)**

```ts
export const TaskRunUpdated = defineBusEvent(
  "task-run.updated",
  z.object({
    runId: z.string(),
    taskSessionId: z.string(),
    state: z.enum([
      "queued",
      "running",
      "cancel_requested",
      "completed",
      "failed",
      "canceled",
      "stale",
      "dead",
    ]),
    runtimeMode: z.enum(["intake", "plan", "build"]),
    eventSeq: z.number(),
    workerId: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
  })
);

export const TaskRunCompleted = defineBusEvent(
  "task-run.completed",
  z.object({ runId: z.string(), taskSessionId: z.string() })
);
```

**Step 4: Run tests to pass**

Run:

1. `pnpm --filter @sakti-code/server test src/bus/__tests__/task-events.test.ts`
2. `pnpm --filter @sakti-code/shared test`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/bus/index.ts packages/shared/src/event-types.ts packages/shared/src/event-guards.ts
git commit -m "feat(shared): add task run event contracts"
```

---

### Task 10: Implement task runs API routes

**Files:**

- Create: `packages/server/src/routes/task-runs.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Add failing tests for all endpoint branches (RED)**

```ts
it("returns 422 on invalid runtimeMode", async () => {
  // POST invalid mode
});

it("returns 409 when active run exists and policy single-active is enforced", async () => {
  // create active run then POST new
});

it("GET /api/task-sessions/:id/runs returns sorted recent first", async () => {
  // seed two runs and verify order
});

it("GET /api/runs/:runId returns run detail", async () => {
  // verify shape includes lease and progress cursor
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-runs.test.ts`
Expected: FAIL.

**Step 3: Implement route handlers (GREEN)**

```ts
app.post("/api/task-sessions/:taskSessionId/runs", async c => {
  // validate body
  // enforce idempotency
  // optionally enforce single active run
  // create run + append initial event
  // publish TaskRunUpdated
  // return 201 or 200 idempotent hit
});

app.get("/api/task-sessions/:taskSessionId/runs", async c => {
  // list runs
});

app.get("/api/runs/:runId", async c => {
  // run detail
});

app.post("/api/runs/:runId/cancel", async c => {
  // request cancel and publish run update
});
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-runs.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/task-runs.ts packages/server/src/routes/__tests__/task-runs.test.ts packages/server/src/index.ts
git commit -m "feat(server): add task run control api"
```

---

### Task 11: Implement run event replay API routes

**Files:**

- Create: `packages/server/src/routes/run-events.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Add failing replay tests (RED)**

```ts
it("GET /api/runs/:runId/events returns ordered events after cursor", async () => {
  // seed and verify
});

it("GET /api/runs/:runId/events:sse streams backlog then tails", async () => {
  // open stream, append event, verify delivery
});

it("rejects invalid cursor", async () => {
  // afterEventSeq=-1 -> 400
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/run-events.test.ts`
Expected: FAIL.

**Step 3: Implement replay + SSE endpoint (GREEN)**

```ts
app.get("/api/runs/:runId/events", async c => {
  // parse query
  // listTaskRunEventsAfter
  // return events + hasMore
});

app.get("/api/runs/:runId/events:sse", async c => {
  // send connected event
  // replay backlog > cursor
  // subscribe to TaskRunUpdated/MessageUpdated/MessagePartUpdated for runId
  // onAbort unsubscribe
});
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/run-events.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/run-events.ts packages/server/src/routes/__tests__/run-events.test.ts packages/server/src/index.ts
git commit -m "feat(server): add task run event replay and sse"
```

---

### Task 12: Build worker execution service with tick loop

**Files:**

- Modify: `packages/server/src/services/task-run-worker.ts`

**Step 1: Add failing tests for controller integration (RED)**

```ts
it("creates/reuses SessionController and executes input task", async () => {
  // mock getSessionManager + controller.processMessage
});

it("appends started/progress/terminal run events", async () => {
  // assert appendTaskRunEvent calls
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-worker.test.ts`
Expected: FAIL.

**Step 3: Implement worker service (GREEN)**

```ts
export function createTaskRunWorker(input: {
  workerId: string;
  pollIntervalMs: number;
  leaseMs: number;
}) {
  // start/stop
  // tickOnce:
  // 1) claimNextTaskSessionRun
  // 2) append run.updated running
  // 3) execute via controller.processMessage
  // 4) append message/run terminal events
  // 5) mark completed/failed/canceled
}
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-worker.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/services/task-run-worker.ts packages/server/src/services/__tests__/task-run-worker.test.ts
git commit -m "feat(server): implement background task run worker"
```

---

### Task 13: Add recovery sweeper and stale lease handling

**Files:**

- Modify: `packages/server/src/services/task-run-recovery.ts`

**Step 1: Add failing tests for stale/dead transitions (RED)**

```ts
it("requeues stale runs below max attempts", async () => {
  // expired run attempt=1 max=3 => queued attempt=2
});

it("marks dead when attempts exhausted", async () => {
  // expired run attempt=3 max=3 => dead
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-recovery.test.ts`
Expected: FAIL.

**Step 3: Implement recovery logic (GREEN)**

```ts
export async function sweepExpiredTaskRunLeases(now = new Date()) {
  const expired = await listExpiredLeasedRuns(now);
  for (const run of expired) {
    if (run.attempt < run.maxAttempts) {
      await requeueStaleRun(run.runId);
      await appendTaskRunEvent({
        runId: run.runId,
        taskSessionId: run.taskSessionId,
        eventType: "task-run.updated",
        payload: { state: "queued", reason: "lease_expired" },
      });
    } else {
      await markDeadRun(run.runId, "max_attempts_exhausted_after_lease_expiry");
      await appendTaskRunEvent({
        runId: run.runId,
        taskSessionId: run.taskSessionId,
        eventType: "task-run.updated",
        payload: { state: "dead" },
      });
    }
  }
}
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/services/__tests__/task-run-recovery.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/services/task-run-recovery.ts packages/server/src/services/__tests__/task-run-recovery.test.ts
git commit -m "feat(server): add stale lease recovery for background runs"
```

---

### Task 14: Integrate worker startup/shutdown lifecycle into server boot

**Files:**

- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/runtime.ts`

**Step 1: Add failing lifecycle tests (RED)**

```ts
it("starts worker on server start when background flag enabled", async () => {
  // spy createTaskRunWorker().start
});

it("stops worker on shutdown", async () => {
  // verify stop called on shutdown hook
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/index.test.ts`
Expected: FAIL until worker wiring exists.

**Step 3: Implement lifecycle integration (GREEN)**

```ts
const backgroundRunsEnabled = process.env.SAKTI_CODE_BACKGROUND_RUNS_ENABLED === "true";
let taskRunWorker: ReturnType<typeof createTaskRunWorker> | null = null;

if (backgroundRunsEnabled) {
  taskRunWorker = createTaskRunWorker({
    workerId: `worker-${process.pid}`,
    pollIntervalMs: 250,
    leaseMs: 30000,
  });
  taskRunWorker.start();
}

shutdown.register(
  "task-run-worker",
  async () => {
    await taskRunWorker?.stop();
  },
  20
);
```

**Step 4: Run tests to pass**

Run:

1. `pnpm --filter @sakti-code/server test src/index.test.ts`
2. `pnpm --filter @sakti-code/server typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/index.ts packages/server/src/runtime.ts
git commit -m "feat(server): wire background run worker lifecycle"
```

---

### Task 15: Add `/api/chat` compatibility handoff to run API (feature-flagged)

**Files:**

- Modify: `packages/server/src/routes/chat.ts`
- Modify: `packages/server/src/routes/__tests__/chat.test.ts`

**Step 1: Add failing compatibility tests (RED)**

```ts
it("when background flag enabled, chat creates run and returns run envelope", async () => {
  // POST /api/chat -> includes runId in stream metadata
});

it("legacy path remains when flag disabled", async () => {
  // existing behavior preserved
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/chat.test.ts`
Expected: FAIL for new branches.

**Step 3: Implement compatibility path (GREEN)**

```ts
if (process.env.SAKTI_CODE_BACKGROUND_RUNS_ENABLED === "true") {
  // create run with input from messageText/runtimeMode
  // emit stream data-state queued + run id metadata
  // DO NOT block request waiting on controller completion
  // return stream that can close quickly after queued ack
}
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/chat.test.ts src/routes/__tests__/chat-runtime-mode.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/chat.ts packages/server/src/routes/__tests__/chat.test.ts packages/server/src/routes/__tests__/chat-runtime-mode.test.ts
git commit -m "feat(server): add chat compatibility handoff to background runs"
```

---

### Task 16: Add failing desktop API client tests for task run endpoints

**Files:**

- Create: `apps/desktop/src/core/services/api/__tests__/api-client-task-runs.test.ts`
- Modify: `apps/desktop/src/core/services/api/api-client.ts`

**Step 1: Write failing tests (RED)**

```ts
import { describe, expect, it, vi } from "vitest";
import { SaktiCodeApiClient } from "../api-client";

describe("api-client task runs", () => {
  it("creates run with idempotency header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ run: { runId: "run-1", state: "queued" } }), { status: 201 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new SaktiCodeApiClient({ baseUrl: "http://127.0.0.1:3000", token: "t" });
    const run = await client.createTaskRun("session-1", {
      runtimeMode: "plan",
      input: { message: "x" },
      clientRequestKey: "key-1",
    });

    expect(run.runId).toBe("run-1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/task-sessions/session-1/runs"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Client-Request-Key": "key-1" }),
      })
    );
  });

  it("replays run events after cursor", async () => {
    // GET /api/runs/:runId/events?afterEventSeq=...
  });

  it("requests cancel", async () => {
    // POST /api/runs/:runId/cancel
  });
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/services/api/__tests__/api-client-task-runs.test.ts`
Expected: FAIL because methods do not exist.

**Step 3: Implement client methods (GREEN)**

```ts
async createTaskRun(taskSessionId: string, input: {
  runtimeMode: "intake" | "plan" | "build";
  input: Record<string, unknown>;
  clientRequestKey: string;
}) {}

async listTaskRuns(taskSessionId: string) {}
async getTaskRun(runId: string) {}
async cancelTaskRun(runId: string) {}
async listTaskRunEvents(runId: string, afterEventSeq: number, limit = 200) {}
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/services/api/__tests__/api-client-task-runs.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/services/api/__tests__/api-client-task-runs.test.ts apps/desktop/src/core/services/api/api-client.ts
git commit -m "test(desktop): define task run api client contracts"
```

---

### Task 17: Add run store in desktop state layer

**Files:**

- Create: `apps/desktop/src/core/state/stores/run-store.ts`
- Modify: `apps/desktop/src/core/state/stores/index.ts`
- Modify: `apps/desktop/src/core/state/providers/store-provider.tsx`
- Create: `apps/desktop/src/core/state/stores/__tests__/run-store.test.ts`

**Step 1: Write failing store tests (RED)**

```ts
import { describe, expect, it } from "vitest";
import { createRunStore } from "../run-store";

describe("run-store", () => {
  it("upserts run by id", () => {
    const [, actions] = createRunStore();
    actions.upsert({
      runId: "run-1",
      taskSessionId: "session-1",
      state: "queued",
      runtimeMode: "plan",
      lastEventSeq: 0,
    });
    expect(actions.getById("run-1")?.state).toBe("queued");
  });

  it("tracks active run per task session", () => {
    const [, actions] = createRunStore();
    actions.setActiveRun("session-1", "run-1");
    expect(actions.getActiveRunId("session-1")).toBe("run-1");
  });

  it("tracks lastAppliedEventSeq cursor", () => {
    const [, actions] = createRunStore();
    actions.setLastAppliedEventSeq("run-1", 42);
    expect(actions.getLastAppliedEventSeq("run-1")).toBe(42);
  });
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/state/stores/__tests__/run-store.test.ts`
Expected: FAIL because store missing.

**Step 3: Implement run store (GREEN)**

```ts
export interface RunInfo {
  runId: string;
  taskSessionId: string;
  state:
    | "queued"
    | "running"
    | "cancel_requested"
    | "completed"
    | "failed"
    | "canceled"
    | "stale"
    | "dead";
  runtimeMode: "intake" | "plan" | "build";
  lastEventSeq: number;
  updatedAt?: number;
}

export interface RunActions {
  upsert: (run: RunInfo) => void;
  getById: (runId: string) => RunInfo | undefined;
  setActiveRun: (taskSessionId: string, runId: string | null) => void;
  getActiveRunId: (taskSessionId: string) => string | null;
  setLastAppliedEventSeq: (runId: string, seq: number) => void;
  getLastAppliedEventSeq: (runId: string) => number;
  remove: (runId: string) => void;
}
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/state/stores/__tests__/run-store.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/state/stores/run-store.ts \
  apps/desktop/src/core/state/stores/index.ts \
  apps/desktop/src/core/state/providers/store-provider.tsx \
  apps/desktop/src/core/state/stores/__tests__/run-store.test.ts
git commit -m "feat(desktop): add run store for background execution state"
```

---

### Task 18: Add run event hook for snapshot + catch-up + live stream

**Files:**

- Create: `apps/desktop/src/core/chat/hooks/use-run-events.ts`
- Create: `apps/desktop/src/core/chat/hooks/__tests__/use-run-events.test.tsx`

**Step 1: Write failing hook tests (RED)**

```tsx
it("hydrates snapshot then applies catch-up events then live events", async () => {
  // mock api client listTaskRunEvents + mocked event bus stream
  // assert event apply order and cursor advances
});

it("ignores duplicate events by eventSeq", async () => {
  // deliver same event twice and assert single apply
});

it("detects gap and triggers recovery fetch", async () => {
  // event seq jump from 5 to 8 should fetch 6..7
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/hooks/__tests__/use-run-events.test.tsx`
Expected: FAIL because hook missing.

**Step 3: Implement hook (GREEN)**

```ts
export function useRunEvents(input: {
  runId: Accessor<string | null>;
  taskSessionId: Accessor<string | null>;
  client: Accessor<SaktiCodeApiClient | null>;
  applyEvent: (event: {
    eventSeq: number;
    eventType: string;
    payload: Record<string, unknown>;
  }) => void;
}) {
  // 1) on runId change: fetch events after cursor
  // 2) apply sorted asc
  // 3) attach live source
  // 4) gap detection + refill
}
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/hooks/__tests__/use-run-events.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/chat/hooks/use-run-events.ts apps/desktop/src/core/chat/hooks/__tests__/use-run-events.test.tsx
git commit -m "feat(desktop): add run event hydration and catch-up hook"
```

---

### Task 19: Extend event-router adapter for run event application and invariants

**Files:**

- Modify: `apps/desktop/src/core/chat/domain/event-router-adapter.ts`
- Create: `apps/desktop/src/core/chat/domain/__tests__/run-event-reducer.test.ts`

**Step 1: Add failing reducer/invariant tests (RED)**

```ts
it("applies run events idempotently with monotonic cursor", () => {
  // same seq ignored
});

it("uses stable part keys to prevent duplicate text corruption", () => {
  // repeated message.part.updated for same part id should merge, not duplicate
});

it("triggers full rehydrate when invariant fails", () => {
  // tool result without corresponding call should call recovery callback
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/domain/__tests__/run-event-reducer.test.ts`
Expected: FAIL.

**Step 3: Implement reducer enhancements (GREEN)**

```ts
// add run-aware cursor map + dedupe check
// assert invariant:
// - part.messageID exists
// - no duplicate part id per message
// - tool-result references existing tool-call id
// on violation: emit recovery event "sakti-code:run-rehydrate-required"
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/domain/__tests__/run-event-reducer.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/chat/domain/event-router-adapter.ts apps/desktop/src/core/chat/domain/__tests__/run-event-reducer.test.ts
git commit -m "feat(desktop): harden run event reducer against corruption"
```

---

### Task 20: Modify `use-chat` stop/unmount behavior to avoid cancel-by-default

**Files:**

- Modify: `apps/desktop/src/core/chat/hooks/use-chat.ts`
- Create: `apps/desktop/src/core/chat/hooks/__tests__/use-chat-background-stop.test.tsx`

**Step 1: Add failing behavior tests (RED)**

```tsx
it("unmount detaches local request stream without canceling server run", async () => {
  // mount hook, simulate active run, unmount
  // assert no cancel API call
});

it("explicit stop action issues cancel when user requests", async () => {
  // call explicit cancel handler and assert cancel API invoked
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/hooks/__tests__/use-chat-background-stop.test.tsx`
Expected: FAIL.

**Step 3: Implement behavior split (GREEN)**

```ts
// in useChat:
// - keep abort of local fetch to free client resources
// - do NOT call cancel run api inside onCleanup
// - add explicit cancelCurrentRun() method for user action path
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/hooks/__tests__/use-chat-background-stop.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/chat/hooks/use-chat.ts apps/desktop/src/core/chat/hooks/__tests__/use-chat-background-stop.test.tsx
git commit -m "feat(desktop): separate local stream stop from server run cancellation"
```

---

### Task 21: Integrate run lifecycle into workspace provider

**Files:**

- Modify: `apps/desktop/src/core/state/providers/workspace-provider.tsx`
- Modify: `apps/desktop/src/views/workspace-view/index.tsx`
- Create: `apps/desktop/src/core/state/providers/__tests__/workspace-provider-runs.test.tsx`

**Step 1: Add failing provider tests (RED)**

```tsx
it("tracks active run per task session and preserves while switching tasks", async () => {
  // create two task sessions and one running run, switch away and back
  // assert active run remains and cursor retained
});

it("hydrates runs list with task sessions on refresh", async () => {
  // listTaskRuns invoked for visible task sessions
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/state/providers/__tests__/workspace-provider-runs.test.tsx`
Expected: FAIL.

**Step 3: Implement provider run state wiring (GREEN)**

```ts
// workspace provider value additions:
// - runsByTaskSession
// - activeRunIdByTaskSession
// - refreshTaskRuns(taskSessionId)
// - setActiveRun(taskSessionId, runId)
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/core/state/providers/__tests__/workspace-provider-runs.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/state/providers/workspace-provider.tsx \
  apps/desktop/src/views/workspace-view/index.tsx \
  apps/desktop/src/core/state/providers/__tests__/workspace-provider-runs.test.tsx
git commit -m "feat(desktop): wire task run state into workspace provider"
```

---

### Task 22: Add task switch integration test for background continuation

**Files:**

- Create: `apps/desktop/tests/integration/task-switch-background-run-catchup.test.tsx`

**Step 1: Write failing integration test (RED)**

```tsx
it("switching task sessions preserves background run and catches up without duplication", async () => {
  // Arrange:
  // - task1 run emitting seq 1..5
  // - switch to task2 and hydrate task2 snapshot
  // - while on task2, task1 emits seq 6..8
  // Act:
  // - switch back to task1
  // Assert:
  // - snapshot renders immediately
  // - catch-up applies 6..8 once
  // - no duplicated parts/messages
});
```

**Step 2: Run test to verify fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/task-switch-background-run-catchup.test.tsx`
Expected: FAIL.

**Step 3: Implement minimum glue for pass (GREEN)**

```ts
// likely modifications in:
// - use-run-events hook
// - workspace provider run cursor persistence
// - event-router adapter dedupe
```

**Step 4: Run test to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/task-switch-background-run-catchup.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/tests/integration/task-switch-background-run-catchup.test.tsx \
  apps/desktop/src/core/chat/hooks/use-run-events.ts \
  apps/desktop/src/core/state/providers/workspace-provider.tsx \
  apps/desktop/src/core/chat/domain/event-router-adapter.ts
git commit -m "test(desktop): enforce robust task switch catch-up semantics"
```

---

### Task 23: Expand reconnect/catch-up tests for overlap and gap handling

**Files:**

- Modify: `apps/desktop/tests/integration/reconnect-catchup-rendering.test.tsx`

**Step 1: Add failing scenarios (RED)**

```tsx
it("handles overlap replay where snapshot already contains part and replay repeats it", async () => {
  // dedupe expected
});

it("handles sequence gap by refetching missing window", async () => {
  // inject seq 10 then 12 and expect fetch for 11
});

it("does not corrupt assistant text when deltas replay out-of-band", async () => {
  // text part remains stable and final content exact
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/reconnect-catchup-rendering.test.tsx`
Expected: FAIL.

**Step 3: Implement robust catch-up logic (GREEN)**

```ts
// in use-run-events + adapter:
// - maintain per-run cursor
// - detect non-contiguous seq and request gap fill
// - apply strict > lastAppliedSeq only
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/reconnect-catchup-rendering.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/tests/integration/reconnect-catchup-rendering.test.tsx \
  apps/desktop/src/core/chat/hooks/use-run-events.ts \
  apps/desktop/src/core/chat/domain/event-router-adapter.ts
git commit -m "test(desktop): harden reconnect replay overlap and gap handling"
```

---

### Task 24: Add server integration tests for run APIs with session bridge headers

**Files:**

- Modify: `packages/server/src/routes/__tests__/task-runs.test.ts`
- Modify: `packages/server/src/middleware/__tests__/session-bridge.test.ts`

**Step 1: Add failing tests (RED)**

```ts
it("run endpoints require/propagate X-Task-Session-ID context", async () => {
  // verify header response and context not broken
});

it("run replay endpoint rejects run/session mismatch", async () => {
  // run belongs to session A, request with session B should 409
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-runs.test.ts src/middleware/__tests__/session-bridge.test.ts`
Expected: FAIL.

**Step 3: Implement constraints (GREEN)**

```ts
// validate run.taskSessionId against request-bound session when required
// return 409 mismatch conflict
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-runs.test.ts src/middleware/__tests__/session-bridge.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/__tests__/task-runs.test.ts \
  packages/server/src/middleware/__tests__/session-bridge.test.ts \
  packages/server/src/routes/task-runs.ts
git commit -m "feat(server): enforce run and task-session context integrity"
```

---

### Task 25: Add run progress projection into task session status updates

**Files:**

- Modify: `packages/server/src/services/task-run-worker.ts`
- Modify: `packages/server/db/task-sessions.ts`
- Modify: `packages/server/src/routes/task-sessions.ts`

**Step 1: Add failing tests for status transitions (RED)**

```ts
it("sets task session status implementing when run starts in build mode", async () => {
  // run start -> task session status implementing
});

it("sets task session status completed/failed on terminal run state", async () => {
  // completed/failed projection
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-sessions.test.ts`
Expected: FAIL.

**Step 3: Implement status projection (GREEN)**

```ts
// worker on running(build) -> updateTaskSessionStatus(sessionId, "implementing")
// worker on completed -> updateTaskSessionStatus(sessionId, "completed")
// worker on failed/dead -> updateTaskSessionStatus(sessionId, "failed")
// publish TaskSessionUpdated after each
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/task-sessions.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/services/task-run-worker.ts packages/server/db/task-sessions.ts packages/server/src/routes/task-sessions.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "feat(server): project run lifecycle into task session status"
```

---

### Task 26: Add cancel API wiring to desktop UI action paths

**Files:**

- Modify: `apps/desktop/src/views/workspace-view/chat-area/chat-area.tsx`
- Modify: `apps/desktop/src/core/chat/hooks/use-chat.ts`
- Create: `apps/desktop/src/views/workspace-view/chat-area/__tests__/run-cancel-action.test.tsx`

**Step 1: Add failing UI tests (RED)**

```tsx
it("clicking stop sends cancel for active run and reflects cancel_requested state", async () => {
  // render with active run and trigger stop control
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/views/workspace-view/chat-area/__tests__/run-cancel-action.test.tsx`
Expected: FAIL.

**Step 3: Implement explicit cancel action (GREEN)**

```ts
// ChatArea stop button -> chat.cancelCurrentRun()
// cancelCurrentRun delegates to apiClient.cancelTaskRun(activeRunId)
// update run store state cancel_requested optimistically
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/views/workspace-view/chat-area/__tests__/run-cancel-action.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/views/workspace-view/chat-area/chat-area.tsx \
  apps/desktop/src/core/chat/hooks/use-chat.ts \
  apps/desktop/src/views/workspace-view/chat-area/__tests__/run-cancel-action.test.tsx
git commit -m "feat(desktop): add explicit run cancel action"
```

---

### Task 27: Add run-aware task session list metadata and badges

**Files:**

- Modify: `apps/desktop/src/views/workspace-view/left-side/session-list.tsx`
- Modify: `apps/desktop/src/views/workspace-view/left-side/session-card.tsx`
- Create: `apps/desktop/src/views/workspace-view/left-side/__tests__/session-run-badges.test.tsx`

**Step 1: Add failing UI tests (RED)**

```tsx
it("shows running badge when session has active running run", () => {});
it("shows queued/cancel_requested/failed badges consistently", () => {});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/views/workspace-view/left-side/__tests__/session-run-badges.test.tsx`
Expected: FAIL.

**Step 3: Implement run badge rendering (GREEN)**

```tsx
// derive badge from active run state
// precedence: cancel_requested > running > queued > failed > completed
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run src/views/workspace-view/left-side/__tests__/session-run-badges.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/views/workspace-view/left-side/session-list.tsx \
  apps/desktop/src/views/workspace-view/left-side/session-card.tsx \
  apps/desktop/src/views/workspace-view/left-side/__tests__/session-run-badges.test.tsx
git commit -m "feat(desktop): surface run lifecycle badges in task session list"
```

---

### Task 28: Add robust desktop smoke test for switching tasks during active background run

**Files:**

- Modify: `apps/desktop/tests/e2e/homepage-task-session-workflow.test.tsx`
- Create: `apps/desktop/tests/e2e/background-run-task-switching.test.tsx`

**Step 1: Write failing e2e test (RED)**

```ts
it("task run continues while viewing other task session", async () => {
  // create task A + run A
  // switch to task B
  // poll run A -> still running/completed
  // switch back to A -> catch-up content appears once
});
```

**Step 2: Run test to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/e2e/background-run-task-switching.test.tsx`
Expected: FAIL.

**Step 3: Implement required glue (GREEN)**

```ts
// ensure provider refresh + run event hook + route availability
```

**Step 4: Run test to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/e2e/background-run-task-switching.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/tests/e2e/background-run-task-switching.test.tsx apps/desktop/tests/e2e/homepage-task-session-workflow.test.tsx
git commit -m "test(desktop): verify background run continuity across task switching"
```

---

### Task 29: Add server fault-injection tests (worker crash/restart recovery)

**Files:**

- Create: `packages/server/tests/integration/background-run-recovery.e2e.test.ts`

**Step 1: Write failing integration tests (RED)**

```ts
it("requeues expired running run after simulated worker death", async () => {
  // create run running with old lease
  // call recovery sweep
  // expect queued with attempt+1
});

it("marks dead when max attempts exceeded", async () => {
  // stale + attempt=max
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test tests/integration/background-run-recovery.e2e.test.ts`
Expected: FAIL.

**Step 3: Implement any missing recovery fields/logic (GREEN)**

```ts
// finalize stale->queued/dead with reason
// emit task-run.updated terminal states
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test tests/integration/background-run-recovery.e2e.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/tests/integration/background-run-recovery.e2e.test.ts packages/server/src/services/task-run-recovery.ts
git commit -m "test(server): validate worker crash recovery lifecycle"
```

---

### Task 30: Add event consistency tests for run event stream and bus bridge

**Files:**

- Modify: `packages/server/src/routes/__tests__/event.test.ts`
- Create: `packages/server/src/routes/__tests__/run-events-ordering.test.ts`

**Step 1: Add failing tests (RED)**

```ts
it("run-events sse emits event ids and strict event_seq order", async () => {
  // append out of order attempts and verify stream order from storage
});

it("does not duplicate when replay overlaps live emission", async () => {
  // cursor replay + new event appended during stream
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/run-events-ordering.test.ts src/routes/__tests__/event.test.ts`
Expected: FAIL.

**Step 3: Implement ordering-safe replay/tail logic (GREEN)**

```ts
// run-events SSE:
// - replay loop from cursor
// - switch to subscription tail only after replay cursor captured
// - guard to emit each seq once
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/run-events-ordering.test.ts src/routes/__tests__/event.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/__tests__/run-events-ordering.test.ts packages/server/src/routes/__tests__/event.test.ts packages/server/src/routes/run-events.ts
git commit -m "feat(server): harden run event sse ordering and overlap behavior"
```

---

### Task 31: Add desktop reducer invariants and full-rehydrate fallback integration

**Files:**

- Modify: `apps/desktop/src/core/chat/domain/event-router-adapter.ts`
- Modify: `apps/desktop/src/core/state/providers/workspace-provider.tsx`
- Create: `apps/desktop/tests/integration/run-rehydrate-fallback.test.tsx`

**Step 1: Write failing fallback test (RED)**

```tsx
it("triggers full rehydrate on invariant violation and converges to canonical state", async () => {
  // dispatch malformed tool result event first
  // expect fallback request + stable final rendered content
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/run-rehydrate-fallback.test.tsx`
Expected: FAIL.

**Step 3: Implement fallback path (GREEN)**

```ts
// adapter emits rehydrate-required custom event with run/task ids
// workspace provider listens and calls:
// - fetch run snapshot
// - fetch run events from 0 or last safe cursor
// - replace corrupted projection with canonical reconstruction
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/run-rehydrate-fallback.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/chat/domain/event-router-adapter.ts \
  apps/desktop/src/core/state/providers/workspace-provider.tsx \
  apps/desktop/tests/integration/run-rehydrate-fallback.test.tsx
git commit -m "feat(desktop): add full rehydrate fallback for invariant violations"
```

---

### Task 32: Add end-to-end contract test for snapshot + catch-up + live merge correctness

**Files:**

- Create: `apps/desktop/tests/integration/snapshot-catchup-live-merge.test.tsx`

**Step 1: Write failing contract test (RED)**

```tsx
it("hydrates snapshot and merges replay/live events without corruption", async () => {
  // snapshot includes seq 1..20
  // replay returns 21..25
  // live emits 26..30
  // assert final projection equals canonical reducer output and no duplicate parts
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/snapshot-catchup-live-merge.test.tsx`
Expected: FAIL.

**Step 3: Implement missing merge semantics (GREEN)**

```ts
// ensure same reducer code path for snapshot/replay/live
// single apply pipeline with cursor guard
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/snapshot-catchup-live-merge.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/tests/integration/snapshot-catchup-live-merge.test.tsx \
  apps/desktop/src/core/chat/hooks/use-run-events.ts \
  apps/desktop/src/core/chat/domain/event-router-adapter.ts
git commit -m "test(desktop): enforce snapshot-replay-live merge integrity"
```

---

### Task 33: Update server docs and operational runbook

**Files:**

- Create: `docs/architecture/background-task-runs.md`
- Create: `docs/ops/background-run-recovery-runbook.md`
- Modify: `docs/TASK_FIRST_WORKFLOW.md`

**Step 1: Add failing docs checks (RED)**

```bash
# if docs lint or link check exists, add these docs to check set
```

**Step 2: Run docs checks to fail**

Run: `pnpm lint` (or repo docs checks if present)
Expected: FAIL if missing references/anchors.

**Step 3: Write docs (GREEN)**

```md
# background-task-runs.md

- state machine
- api contracts
- replay model
- cursor semantics
- feature flag rollout

# background-run-recovery-runbook.md

- incident symptoms
- stale sweep commands
- force cancel/requeue steps
- verification queries
```

**Step 4: Run checks to pass**

Run: `pnpm lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/architecture/background-task-runs.md docs/ops/background-run-recovery-runbook.md docs/TASK_FIRST_WORKFLOW.md
git commit -m "docs: document background run architecture and recovery runbook"
```

---

### Task 34: Add final server regression tests for legacy chat compatibility

**Files:**

- Modify: `packages/server/src/routes/__tests__/chat.test.ts`
- Modify: `packages/server/src/routes/__tests__/chat-provider-selection.test.ts`

**Step 1: Add failing compatibility tests (RED)**

```ts
it("legacy chat stream still works when background flag disabled", async () => {
  // existing streaming semantics preserved
});

it("provider selection and auth behavior unchanged", async () => {
  // existing tests extended with background flag toggles
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/chat.test.ts src/routes/__tests__/chat-provider-selection.test.ts`
Expected: FAIL.

**Step 3: Implement compatibility guards (GREEN)**

```ts
// explicit branch in chat route keyed by feature flag
// maintain old behavior path untouched when disabled
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/server test src/routes/__tests__/chat.test.ts src/routes/__tests__/chat-provider-selection.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/__tests__/chat.test.ts packages/server/src/routes/__tests__/chat-provider-selection.test.ts packages/server/src/routes/chat.ts
git commit -m "test(server): lock legacy chat compatibility behind feature flag"
```

---

### Task 35: Add final desktop regression tests for existing chat timeline behavior

**Files:**

- Modify: `apps/desktop/tests/integration/chat-stream-rendering.test.tsx`
- Modify: `apps/desktop/tests/integration/chat-retry-replay.test.tsx`

**Step 1: Add failing regression assertions (RED)**

```tsx
it("existing timeline rendering remains correct with background run metadata present", async () => {
  // same rendering order and labels
});

it("retry state still clears to idle on terminal events", async () => {
  // unchanged expected behavior
});
```

**Step 2: Run tests to fail**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/chat-stream-rendering.test.tsx tests/integration/chat-retry-replay.test.tsx`
Expected: FAIL.

**Step 3: Implement compatibility adjustments (GREEN)**

```ts
// ignore unknown run metadata where not needed
// ensure timeline projection unaffected by new run events
```

**Step 4: Run tests to pass**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/chat-stream-rendering.test.tsx tests/integration/chat-retry-replay.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/tests/integration/chat-stream-rendering.test.tsx apps/desktop/tests/integration/chat-retry-replay.test.tsx
git commit -m "test(desktop): protect existing chat timeline behavior with background runs"
```

---

### Task 36: Full verification before completion (`@superpowers/verification-before-completion`)

**Files:**

- No code changes expected unless fixes needed.

**Step 1: Run full server verification**

Run:

1. `pnpm --filter @sakti-code/server lint`
2. `pnpm --filter @sakti-code/server typecheck`
3. `pnpm --filter @sakti-code/server test`
4. `pnpm migrations:check:server`

Expected: PASS.

**Step 2: Run full desktop verification**

Run:

1. `pnpm --filter @sakti-code/desktop lint`
2. `pnpm --filter @sakti-code/desktop typecheck`
3. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-ui-jsdom`
4. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract`

Expected: PASS.

**Step 3: Run targeted workflow verification**

Run:

1. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract tests/integration/task-switch-background-run-catchup.test.tsx`
2. `pnpm --filter @sakti-code/server test tests/integration/background-run-recovery.e2e.test.ts`

Expected: PASS.

**Step 4: Validate no migration policy regressions**

Run:

1. `pnpm migrations:check:server`
2. `git diff --name-status origin/main...HEAD -- packages/server/drizzle`

Expected: only append-only migration artifacts added.

**Step 5: Commit verification notes**

```bash
git add -A
git commit -m "chore: finalize verification for background task run execution"
```

---

## Detailed Route/API Contract (Implementation Target)

### POST `/api/task-sessions/:taskSessionId/runs`

Request:

```json
{
  "runtimeMode": "plan",
  "input": {
    "message": "Prepare implementation roadmap"
  },
  "clientRequestKey": "client-key-123"
}
```

Response (created):

```json
{
  "run": {
    "runId": "019c....",
    "taskSessionId": "019c....",
    "runtimeMode": "plan",
    "state": "queued",
    "attempt": 0,
    "maxAttempts": 3,
    "createdAt": "2026-02-25T...",
    "updatedAt": "2026-02-25T...",
    "lastEventSeq": 1
  }
}
```

Status codes:

1. `201` new run created.
2. `200` idempotency hit returns existing run.
3. `400` invalid payload.
4. `404` unknown task session.
5. `409` single-active policy conflict.
6. `500` unexpected failure.

### GET `/api/task-sessions/:taskSessionId/runs`

Query:

1. `limit` default `20`, max `100`.

Response:

```json
{
  "runs": [
    {
      "runId": "...",
      "taskSessionId": "...",
      "runtimeMode": "build",
      "state": "running",
      "attempt": 1,
      "maxAttempts": 3,
      "leaseOwner": "worker-123",
      "leaseExpiresAt": "2026-...",
      "lastHeartbeatAt": "2026-...",
      "startedAt": "2026-...",
      "finishedAt": null,
      "error": null,
      "createdAt": "2026-...",
      "updatedAt": "2026-..."
    }
  ]
}
```

### GET `/api/runs/:runId`

Response identical run object.

### POST `/api/runs/:runId/cancel`

Response:

```json
{
  "run": {
    "runId": "...",
    "state": "cancel_requested"
  }
}
```

### GET `/api/runs/:runId/events`

Query:

1. `afterEventSeq` optional, default `0`.
2. `limit` default `200`, max `1000`.

Response:

```json
{
  "runId": "...",
  "events": [
    {
      "eventId": "019c...",
      "runId": "...",
      "taskSessionId": "...",
      "eventSeq": 42,
      "eventType": "message.part.updated",
      "payload": { "part": { "id": "..." } },
      "createdAt": "2026-..."
    }
  ],
  "hasMore": false,
  "lastEventSeq": 42
}
```

### GET `/api/runs/:runId/events:sse`

SSE event payload shape:

```json
{
  "type": "task-run.updated",
  "eventId": "019c...",
  "runId": "...",
  "taskSessionId": "...",
  "eventSeq": 43,
  "timestamp": 1772040000000,
  "properties": {
    "state": "running",
    "runtimeMode": "build"
  }
}
```

---

## Worker State Machine (Implementation Contract)

### States

1. `queued`
2. `running`
3. `cancel_requested`
4. `completed`
5. `failed`
6. `canceled`
7. `stale`
8. `dead`

### Allowed transitions

1. `queued -> running`
2. `queued -> canceled` (cancel before claim)
3. `running -> cancel_requested`
4. `running -> completed`
5. `running -> failed`
6. `running -> canceled`
7. `running -> stale` (lease expiry)
8. `stale -> queued` (attempt < max)
9. `stale -> dead` (attempt >= max)
10. `failed -> queued` (retry policy path)
11. `failed -> dead` (non-retryable or exhausted)

### Invalid transitions (must reject)

1. `completed -> *`
2. `canceled -> *`
3. `dead -> *`
4. `queued -> completed` without running claim
5. `running -> running` by different worker owner

---

## Desktop Reconciliation Rules (Implementation Contract)

### Cursor and dedupe

1. Store `lastAppliedEventSeq` per `runId`.
2. Ignore incoming event where `eventSeq <= lastAppliedEventSeq`.
3. Advance cursor only after successful reducer apply.

### Gap handling

1. If `eventSeq > lastAppliedEventSeq + 1`, pause live apply.
2. Fetch missing range via `/api/runs/:runId/events?afterEventSeq=<cursor>`.
3. Apply missing in ascending order.
4. Resume live apply.

### Stable keying

1. `message.updated` keyed by `message.id`.
2. `message.part.updated` keyed by `part.id`.
3. Text deltas update stable text part, never append duplicate parts.
4. Tool results keyed by `toolCallId` must patch existing tool part.

### Invariants

1. Every part must reference existing message.
2. Every message must reference existing session.
3. Tool result must have corresponding tool call part.
4. Session/run mismatch events are ignored.

### Recovery

1. On invariant failure, emit rehydrate-required event.
2. Rehydrate from run snapshot + replay from cursor `0` or last safe checkpoint.
3. Replace local projection atomically.

---

## Rollout Plan (Feature Flagged)

### Flag

`SAKTI_CODE_BACKGROUND_RUNS_ENABLED`

### Stage A (off by default)

1. Deploy schema + DB modules + APIs + worker code.
2. Keep `/api/chat` existing behavior.
3. Run shadow tests in CI.

### Stage B (on in dev)

1. Enable flag locally/CI.
2. Validate run APIs + desktop integration.
3. Monitor stale/dead counters.

### Stage C (on in production gradually)

1. Enable for selected environments.
2. Keep fallback path to legacy chat behavior toggled.
3. Confirm no replay corruption and no data drift.

---

## Risk Register and Mitigations

### Risk 1: Double execution from duplicate create requests

Mitigation:

1. Unique `(task_session_id, client_request_key)` index.
2. Return existing run on conflict.
3. Regression tests for duplicate POST.

### Risk 2: SQLite lock contention due to event write bursts

Mitigation:

1. Batch non-critical progress events (optional micro-batching).
2. Keep transaction scope minimal.
3. Reuse existing busy-timeout pragmas.

### Risk 3: Event overlap duplication on replay + live tail

Mitigation:

1. Strict cursor guard (`>` only).
2. Single apply pipeline for replay and live.
3. Explicit overlap tests.

### Risk 4: Worker crash leaves run permanently running

Mitigation:

1. Lease expiry sweeper.
2. `stale` state and retry/dead transitions.
3. Recovery integration tests.

### Risk 5: Task switching introduces projection corruption

Mitigation:

1. Stable keys + idempotent reducer.
2. Invariant checks + full rehydrate fallback.
3. Task-switch catch-up tests.

---

## Definition of Done

1. Server background run APIs implemented and fully tested.
2. Worker executes independently of UI/request lifecycle.
3. Desktop task switching preserves background run continuity.
4. Snapshot + replay + live merge is deterministic and corruption-safe.
5. Recovery logic handles stale leases and exhausted attempts.
6. Legacy behavior remains behind flag and fully covered.
7. Lint, typecheck, targeted and full test suites pass.
8. Migration checks pass with append-only compliance.
9. Architecture and recovery docs are updated.
10. Final verification evidence captured in commit history.

---

## Command Checklist for Implementation Session

### Per-task RED/GREEN loop

1. `pnpm --filter @sakti-code/server test <target>`
2. `pnpm --filter @sakti-code/desktop exec vitest run <target>`
3. `pnpm --filter @sakti-code/server typecheck`
4. `pnpm --filter @sakti-code/desktop typecheck`

### Per-phase health check

1. `pnpm --filter @sakti-code/server lint`
2. `pnpm --filter @sakti-code/desktop lint`
3. `pnpm migrations:check:server`

### Pre-merge full check

1. `pnpm --filter @sakti-code/server test`
2. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-contract`
3. `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-ui-jsdom`
4. `pnpm lint`
5. `pnpm typecheck`

---

## Appendices

## Appendix A: Run event type catalog

1. `task-run.updated`
2. `task-run.started`
3. `task-run.heartbeat`
4. `task-run.cancel-requested`
5. `task-run.canceled`
6. `task-run.completed`
7. `task-run.failed`
8. `task-run.stale`
9. `task-run.dead`
10. `message.updated`
11. `message.part.updated`
12. `session.status`

## Appendix B: Suggested run payload shape

```ts
interface TaskRunInfo {
  runId: string;
  taskSessionId: string;
  runtimeMode: "intake" | "plan" | "build";
  state:
    | "queued"
    | "running"
    | "cancel_requested"
    | "completed"
    | "failed"
    | "canceled"
    | "stale"
    | "dead";
  input: Record<string, unknown>;
  clientRequestKey: string;
  attempt: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
  cancelRequestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Appendix C: Suggested run event payload shape

```ts
interface TaskRunEventInfo {
  eventId: string;
  runId: string;
  taskSessionId: string;
  eventSeq: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

## Appendix D: Concrete anti-corruption assertions in desktop reducer

1. `assert(messageExists(part.messageID))`
2. `assert(uniquePartIdPerMessage(part.id, part.messageID))`
3. `assert(toolResultHasCall(toolCallId))`
4. `assertMonotonicCursor(eventSeq, lastAppliedSeq)`
5. `assertEventSessionMatch(event.taskSessionId, activeTaskSessionId)`

On any assertion failure:

```ts
dispatchEvent(
  new CustomEvent("sakti-code:run-rehydrate-required", {
    detail: { runId, taskSessionId, reason: "invariant_violation" },
  })
);
```

## Appendix E: Suggested SQL debugging queries

```sql
-- Active runs
SELECT run_id, task_session_id, state, lease_owner, lease_expires_at, attempt, max_attempts
FROM task_session_runs
WHERE state IN ('queued','running','cancel_requested','stale');

-- Expired leases
SELECT run_id, task_session_id, state, lease_owner, lease_expires_at
FROM task_session_runs
WHERE state = 'running' AND lease_expires_at < unixepoch() * 1000;

-- Latest events for one run
SELECT event_seq, event_type, created_at
FROM task_run_events
WHERE run_id = ?
ORDER BY event_seq DESC
LIMIT 50;
```

## Appendix F: Suggested metrics

1. `task_run_queue_depth`
2. `task_run_running_count`
3. `task_run_stale_count`
4. `task_run_dead_count`
5. `task_run_claim_latency_ms`
6. `task_run_duration_ms`
7. `task_run_event_append_latency_ms`
8. `task_run_replay_gap_events`
9. `desktop_rehydrate_fallback_count`
10. `desktop_duplicate_event_dropped_count`

## Appendix G: Suggested log fields for all run transitions

1. `runId`
2. `taskSessionId`
3. `runtimeMode`
4. `stateFrom`
5. `stateTo`
6. `workerId`
7. `attempt`
8. `maxAttempts`
9. `leaseExpiresAt`
10. `eventSeq`
11. `requestId`

---

## Implementation sequencing recommendation

1. Complete Tasks 1-11 in one PR (`server foundational`).
2. Complete Tasks 12-15 in second PR (`server worker integration`).
3. Complete Tasks 16-23 in third PR (`desktop run consumption`).
4. Complete Tasks 24-31 in fourth PR (`hardening and recovery`).
5. Complete Tasks 32-36 in fifth PR (`regression + docs + verification`).

---

## Notes for execution agent

1. Keep commits task-scoped and small.
2. Never bypass RED step.
3. Avoid broad refactors outside task scope.
4. Preserve existing task-first workflow semantics (`runtimeMode`, `session_kind`) while introducing runs.
5. Validate every task with targeted tests before moving on.

---

Plan complete.
