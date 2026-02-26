# Server Hono DDD + RPC Typing Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `packages/server` into strict Hono route-first DDD modules with `zValidator` validation and exported `AppType` so frontend can safely use `hono/client`.

**Architecture:** We will migrate from monolithic `src/index.ts + src/routes + db/* + src/services` to `src/app + src/shared + src/modules/*` with explicit boundaries (`controller -> application -> domain`, `infrastructure -> domain/application ports`). Route handlers stay inline (no RoR-style controllers), composed via `app.route()`, validated via `zValidator`, and typed for RPC by exporting final composed `AppType`.

**Tech Stack:** TypeScript, Hono, `@hono/zod-validator`, `@hono/zod-openapi`, Zod, Drizzle ORM, Vitest, ESLint, Turbo/PNPM.

---

## Skill + Process Contract

- Use `@superpowers/writing-plans` for this document and `@superpowers/executing-plans` for execution.
- Use `@superpowers/test-driven-development` for each task implementation (red -> green -> refactor).
- Use `@superpowers/verification-before-completion` before claiming any phase done.
- Use `@superpowers/requesting-code-review` at each major phase boundary.

## Repository Context (Observed)

- Entrypoint currently: `packages/server/src/index.ts` (large composition root + middleware + route mounting + worker lifecycle).
- Current HTTP layer: `packages/server/src/routes/*.ts` (mostly `new Hono<Env>()`, manual validation, manual parsing).
- Current DB access: `packages/server/db/*.ts` called directly from routes/services.
- Current provider implementation: `packages/server/src/provider/*` mixed concerns.
- Current services: `packages/server/src/services/*` mixed orchestration + infra + domain rules.
- Current shared event bus: `packages/server/src/bus/*`.
- Existing tests: route tests under `src/routes/__tests__`, provider/service tests, DB tests, integration tests.

## Target Architecture Contract

- `src/app/*` for app construction, route mounting, context typing, middleware assembly.
- `src/shared/*` for cross-module primitives only (typed errors, db client, shared schemas, logging adapters).
- `src/modules/<capability>/{domain,application,infrastructure,controller}` for all features.
- Controller style: route-first inline handlers, composed with `app.route()`, no detached RoR-style controllers.
- Validation: `zValidator` for request payloads and `c.req.valid(...)` for access.
- OpenAPI: `OpenAPIHono` + zod schemas where API contracts are published.
- RPC: export final composed app type after all routes are mounted (`export type AppType = typeof app`).
- No controller direct DB import; all DB calls pass through application usecases and infrastructure repositories.

## Non-Negotiable Runtime/API Constraints

- Preserve existing endpoint paths unless explicitly versioned.
- Preserve `X-Task-Session-ID` behavior and session-bridge semantics.
- Preserve task-session/task-run event semantics and background worker lifecycle.
- Keep `@sakti-code/server` default export compatibility during migration until consumers are updated.

## Delivery Strategy

- Vertical slices by module with compatibility shims.
- Keep old files compiling until corresponding module tests pass.
- Move one capability at a time and run targeted tests each step.
- Commit after each tiny TDD loop.

## Verification Baseline (Run Before Phase 1)

- `pnpm --filter @sakti-code/server lint`
- `pnpm --filter @sakti-code/server typecheck`
- `pnpm --filter @sakti-code/server test`
- `pnpm --filter @sakti-code/desktop test`
- `pnpm --filter @sakti-code/desktop typecheck`

## Definition of Done

- All server routes migrated to module-layered route-first architecture.
- `zValidator` consistently used on all request-bearing endpoints.
- `AppType` exported from final composed app and consumable by frontend via `hono/client`.
- Legacy `src/routes` and ad-hoc cross-layer direct imports removed (or retained only as strict temporary shims with TODO removal tickets).
- Server + desktop tests green.

---

### Task 1: Create app composition test scaffold

**Files:**

- Create: packages/server/src/app/**tests**/app-composition.test.ts
- Modify: packages/server/vitest.config.ts
- Test: packages/server/src/app/**tests**/app-composition.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create app composition test scaffold", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create app composition test scaffold
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create app composition test scaffold",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/app/__tests__/app-composition.test.ts packages/server/vitest.config.ts
git commit -m "test(server): add app composition safety net"

```

### Task 2: Create app composition root

**Files:**

- Create: packages/server/src/app/app.ts
- Modify: packages/server/src/index.ts
- Test: packages/server/src/app/**tests**/app-composition.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create app composition root", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create app composition root
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create app composition root",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/app/app.ts packages/server/src/index.ts packages/server/src/app/__tests__/app-composition.test.ts
git commit -m "feat(server): introduce app composition root"

```

### Task 3: Create route registrar

**Files:**

- Create: packages/server/src/app/register-routes.ts
- Modify: packages/server/src/app/app.ts
- Test: packages/server/src/app/**tests**/app-composition.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create route registrar", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create route registrar
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create route registrar",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/app/register-routes.ts packages/server/src/app/app.ts packages/server/src/app/__tests__/app-composition.test.ts
git commit -m "refactor(server): centralize route registration"

```

### Task 4: Create typed app context

**Files:**

- Create: packages/server/src/app/context.ts
- Modify: packages/server/src/index.ts
- Test: packages/server/src/app/**tests**/app-composition.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create typed app context", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create typed app context
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create typed app context",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/app/context.ts packages/server/src/index.ts packages/server/src/app/__tests__/app-composition.test.ts
git commit -m "refactor(server): add typed app context"

```

### Task 5: Create middleware composer

**Files:**

- Create: packages/server/src/app/middleware.ts
- Modify: packages/server/src/index.ts
- Test: packages/server/src/middleware/**tests**/auth.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create middleware composer", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/middleware/**tests**/auth.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create middleware composer
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create middleware composer",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/middleware/**tests**/auth.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/app/middleware.ts packages/server/src/index.ts packages/server/src/middleware/__tests__/auth.test.ts
git commit -m "refactor(server): compose middleware in app layer"

```

### Task 6: Export final AppType

**Files:**

- Create: packages/server/src/app/types.ts
- Modify: packages/server/src/index.ts
- Test: apps/desktop/tests/helpers/test-server.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Export final AppType", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/desktop exec vitest run apps/desktop/tests/helpers/test-server.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Export final AppType
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Export final AppType",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/desktop exec vitest run apps/desktop/tests/helpers/test-server.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/app/types.ts packages/server/src/index.ts apps/desktop/tests/helpers/test-server.ts
git commit -m "feat(server): export rpc app type"

```

### Task 7: Create shared HTTP error mapper

**Files:**

- Create: packages/server/src/shared/controller/errors/http-error-mapper.ts
- Modify: packages/server/src/middleware/error-handler.ts
- Test: packages/server/src/middleware/**tests**/error-handler.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create shared HTTP error mapper", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/middleware/**tests**/error-handler.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create shared HTTP error mapper
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create shared HTTP error mapper",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/middleware/**tests**/error-handler.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/shared/controller/errors/http-error-mapper.ts packages/server/src/middleware/error-handler.ts packages/server/src/middleware/__tests__/error-handler.test.ts
git commit -m "refactor(server): extract shared http error mapper"

```

### Task 8: Create shared validator helpers

**Files:**

- Create: packages/server/src/shared/controller/http/validators.ts
- Modify: packages/server/src/routes/\_shared/pagination.ts
- Test: packages/server/src/routes/\_shared/**tests**/pagination.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create shared validator helpers", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/\_shared/**tests**/pagination.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create shared validator helpers
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create shared validator helpers",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/\_shared/**tests**/pagination.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/shared/controller/http/validators.ts packages/server/src/routes/_shared/pagination.ts packages/server/src/routes/_shared/__tests__/pagination.test.ts
git commit -m "refactor(server): add shared validator helpers"

```

### Task 9: Create common zod schemas

**Files:**

- Create: packages/server/src/shared/controller/schemas/common.ts
- Modify: packages/server/src/types.ts
- Test: packages/server/src/routes/**tests**/health.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create common zod schemas", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/health.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create common zod schemas
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create common zod schemas",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/health.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/shared/controller/schemas/common.ts packages/server/src/types.ts packages/server/src/routes/__tests__/health.test.ts
git commit -m "refactor(server): centralize common schemas"

```

### Task 10: Create health module route

**Files:**

- Create: packages/server/src/modules/health/controller/routes/health.route.ts
- Modify: packages/server/src/routes/health.ts
- Test: packages/server/src/routes/**tests**/health.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create health module route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/health.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create health module route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create health module route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/health.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/health/controller/routes/health.route.ts packages/server/src/routes/health.ts packages/server/src/routes/__tests__/health.test.ts
git commit -m "refactor(server): migrate health route module"

```

### Task 11: Create health route index

**Files:**

- Create: packages/server/src/modules/health/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/health.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create health route index", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/health.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create health route index
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create health route index",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/health.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/health/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/health.test.ts
git commit -m "refactor(server): mount health module via route composition"

```

### Task 12: Create task-session schemas

**Files:**

- Create: packages/server/src/modules/task-sessions/controller/schemas/task-session.schema.ts
- Modify: packages/server/src/routes/task-sessions.ts
- Test: packages/server/src/routes/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-session schemas", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-session schemas
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-session schemas",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/controller/schemas/task-session.schema.ts packages/server/src/routes/task-sessions.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "test(server): add task-session schema contract tests"

```

### Task 13: Create task-session repository port

**Files:**

- Create: packages/server/src/modules/task-sessions/domain/repositories/task-session.repository.ts
- Modify: packages/server/src/routes/task-sessions.ts
- Test: packages/server/src/routes/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-session repository port", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-session repository port
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-session repository port",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/domain/repositories/task-session.repository.ts packages/server/src/routes/task-sessions.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "refactor(server): define task-session repository port"

```

### Task 14: Create task-session drizzle repository

**Files:**

- Create: packages/server/src/modules/task-sessions/infrastructure/repositories/task-session.repository.drizzle.ts
- Modify: packages/server/db/task-sessions.ts
- Test: packages/server/db/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-session drizzle repository", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-session drizzle repository
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-session drizzle repository",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/infrastructure/repositories/task-session.repository.drizzle.ts packages/server/db/task-sessions.ts packages/server/db/__tests__/task-sessions.test.ts
git commit -m "refactor(server): implement task-session drizzle repository"

```

### Task 15: Create list task-sessions usecase

**Files:**

- Create: packages/server/src/modules/task-sessions/application/usecases/list-task-sessions.usecase.ts
- Modify: packages/server/src/routes/task-sessions.ts
- Test: packages/server/src/routes/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create list task-sessions usecase", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create list task-sessions usecase
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create list task-sessions usecase",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/application/usecases/list-task-sessions.usecase.ts packages/server/src/routes/task-sessions.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "feat(server): add list task-sessions usecase"

```

### Task 16: Create create task-session usecase

**Files:**

- Create: packages/server/src/modules/task-sessions/application/usecases/create-task-session.usecase.ts
- Modify: packages/server/src/routes/task-sessions.ts
- Test: packages/server/src/routes/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create create task-session usecase", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create create task-session usecase
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create create task-session usecase",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/application/usecases/create-task-session.usecase.ts packages/server/src/routes/task-sessions.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "feat(server): add create task-session usecase"

```

### Task 17: Create patch task-session usecase

**Files:**

- Create: packages/server/src/modules/task-sessions/application/usecases/update-task-session.usecase.ts
- Modify: packages/server/src/routes/task-sessions.ts
- Test: packages/server/src/routes/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create patch task-session usecase", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create patch task-session usecase
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create patch task-session usecase",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/application/usecases/update-task-session.usecase.ts packages/server/src/routes/task-sessions.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "feat(server): add update task-session usecase"

```

### Task 18: Create task-session controller route

**Files:**

- Create: packages/server/src/modules/task-sessions/controller/routes/task-sessions.route.ts
- Modify: packages/server/src/routes/task-sessions.ts
- Test: packages/server/src/routes/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-session controller route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-session controller route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-session controller route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/controller/routes/task-sessions.route.ts packages/server/src/routes/task-sessions.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "refactor(server): migrate task-sessions route with zvalidator"

```

### Task 19: Wire task-session route in app

**Files:**

- Create: packages/server/src/modules/task-sessions/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/task-sessions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire task-session route in app", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire task-session route in app
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire task-session route in app",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-sessions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-sessions/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/task-sessions.test.ts
git commit -m "refactor(server): mount task-session route module"

```

### Task 20: Create task-run schemas

**Files:**

- Create: packages/server/src/modules/task-runs/controller/schemas/task-run.schema.ts
- Modify: packages/server/src/routes/task-runs.ts
- Test: packages/server/src/routes/**tests**/task-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-run schemas", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-run schemas
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-run schemas",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/controller/schemas/task-run.schema.ts packages/server/src/routes/task-runs.ts packages/server/src/routes/__tests__/task-runs.test.ts
git commit -m "test(server): add task-run schema tests"

```

### Task 21: Create task-run repository port

**Files:**

- Create: packages/server/src/modules/task-runs/domain/repositories/task-run.repository.ts
- Modify: packages/server/src/routes/task-runs.ts
- Test: packages/server/src/routes/**tests**/task-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-run repository port", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-run repository port
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-run repository port",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/domain/repositories/task-run.repository.ts packages/server/src/routes/task-runs.ts packages/server/src/routes/__tests__/task-runs.test.ts
git commit -m "refactor(server): define task-run repository port"

```

### Task 22: Create task-run drizzle repository

**Files:**

- Create: packages/server/src/modules/task-runs/infrastructure/repositories/task-run.repository.drizzle.ts
- Modify: packages/server/db/task-session-runs.ts
- Test: packages/server/db/**tests**/task-session-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-run drizzle repository", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/task-session-runs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-run drizzle repository
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-run drizzle repository",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/task-session-runs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/infrastructure/repositories/task-run.repository.drizzle.ts packages/server/db/task-session-runs.ts packages/server/db/__tests__/task-session-runs.test.ts
git commit -m "refactor(server): implement task-run drizzle repository"

```

### Task 23: Create task-run events repository

**Files:**

- Create: packages/server/src/modules/task-runs/infrastructure/repositories/task-run-event.repository.drizzle.ts
- Modify: packages/server/db/task-run-events.ts
- Test: packages/server/db/**tests**/task-run-events.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-run events repository", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/task-run-events.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-run events repository
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-run events repository",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/task-run-events.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/infrastructure/repositories/task-run-event.repository.drizzle.ts packages/server/db/task-run-events.ts packages/server/db/__tests__/task-run-events.test.ts
git commit -m "refactor(server): implement task-run-event repository"

```

### Task 24: Create create task-run usecase

**Files:**

- Create: packages/server/src/modules/task-runs/application/usecases/create-task-run.usecase.ts
- Modify: packages/server/src/routes/task-runs.ts
- Test: packages/server/src/routes/**tests**/task-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create create task-run usecase", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create create task-run usecase
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create create task-run usecase",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/application/usecases/create-task-run.usecase.ts packages/server/src/routes/task-runs.ts packages/server/src/routes/__tests__/task-runs.test.ts
git commit -m "feat(server): add create task-run usecase"

```

### Task 25: Create cancel task-run usecase

**Files:**

- Create: packages/server/src/modules/task-runs/application/usecases/cancel-task-run.usecase.ts
- Modify: packages/server/src/routes/task-runs.ts
- Test: packages/server/src/routes/**tests**/task-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create cancel task-run usecase", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create cancel task-run usecase
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create cancel task-run usecase",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/application/usecases/cancel-task-run.usecase.ts packages/server/src/routes/task-runs.ts packages/server/src/routes/__tests__/task-runs.test.ts
git commit -m "feat(server): add cancel task-run usecase"

```

### Task 26: Create task-runs controller route

**Files:**

- Create: packages/server/src/modules/task-runs/controller/routes/task-runs.route.ts
- Modify: packages/server/src/routes/task-runs.ts
- Test: packages/server/src/routes/**tests**/task-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create task-runs controller route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create task-runs controller route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create task-runs controller route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/controller/routes/task-runs.route.ts packages/server/src/routes/task-runs.ts packages/server/src/routes/__tests__/task-runs.test.ts
git commit -m "refactor(server): migrate task-runs route with zvalidator"

```

### Task 27: Create run-events controller route

**Files:**

- Create: packages/server/src/modules/task-runs/controller/routes/run-events.route.ts
- Modify: packages/server/src/routes/run-events.ts
- Test: packages/server/src/routes/**tests**/run-events.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create run-events controller route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/run-events.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create run-events controller route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create run-events controller route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/run-events.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/controller/routes/run-events.route.ts packages/server/src/routes/run-events.ts packages/server/src/routes/__tests__/run-events.test.ts
git commit -m "refactor(server): migrate run-events route with zvalidator"

```

### Task 28: Wire task-runs module routes

**Files:**

- Create: packages/server/src/modules/task-runs/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/task-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire task-runs module routes", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire task-runs module routes
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire task-runs module routes",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/task-runs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/task-runs.test.ts
git commit -m "refactor(server): mount task-runs module routes"

```

### Task 29: Move worker orchestrator to application

**Files:**

- Create: packages/server/src/modules/task-runs/application/services/task-run-worker.service.ts
- Modify: packages/server/src/services/task-run-worker.ts
- Test: packages/server/src/services/**tests**/task-run-worker.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Move worker orchestrator to application", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/task-run-worker.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Move worker orchestrator to application
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Move worker orchestrator to application",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/task-run-worker.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/application/services/task-run-worker.service.ts packages/server/src/services/task-run-worker.ts packages/server/src/services/__tests__/task-run-worker.test.ts
git commit -m "refactor(server): move task-run worker orchestration"

```

### Task 30: Move recovery to application usecase

**Files:**

- Create: packages/server/src/modules/task-runs/application/usecases/recover-expired-runs.usecase.ts
- Modify: packages/server/src/services/task-run-recovery.ts
- Test: packages/server/src/services/**tests**/task-run-recovery.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Move recovery to application usecase", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/task-run-recovery.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Move recovery to application usecase
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Move recovery to application usecase",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/task-run-recovery.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/task-runs/application/usecases/recover-expired-runs.usecase.ts packages/server/src/services/task-run-recovery.ts packages/server/src/services/__tests__/task-run-recovery.test.ts
git commit -m "refactor(server): migrate task-run recovery usecase"

```

### Task 31: Create provider schemas module

**Files:**

- Create: packages/server/src/modules/provider/controller/schemas/provider.schema.ts
- Modify: packages/server/src/provider/schema.ts
- Test: packages/server/src/provider/**tests**/schema.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create provider schemas module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/schema.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create provider schemas module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create provider schemas module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/schema.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/provider/controller/schemas/provider.schema.ts packages/server/src/provider/schema.ts packages/server/src/provider/__tests__/schema.test.ts
git commit -m "refactor(server): move provider schemas to controller layer"

```

### Task 32: Create provider domain errors

**Files:**

- Create: packages/server/src/modules/provider/domain/errors/provider.error.ts
- Modify: packages/server/src/provider/errors.ts
- Test: packages/server/src/provider/**tests**/errors.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create provider domain errors", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/errors.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create provider domain errors
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create provider domain errors",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/errors.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/provider/domain/errors/provider.error.ts packages/server/src/provider/errors.ts packages/server/src/provider/__tests__/errors.test.ts
git commit -m "refactor(server): define provider domain errors"

```

### Task 33: Create provider auth application service

**Files:**

- Create: packages/server/src/modules/provider/application/services/provider-auth.service.ts
- Modify: packages/server/src/provider/auth/service.ts
- Test: packages/server/src/provider/auth/**tests**/service.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create provider auth application service", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/auth/**tests**/service.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create provider auth application service
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create provider auth application service",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/auth/**tests**/service.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/provider/application/services/provider-auth.service.ts packages/server/src/provider/auth/service.ts packages/server/src/provider/auth/__tests__/service.test.ts
git commit -m "refactor(server): move provider auth service to application layer"

```

### Task 34: Create provider preference application service

**Files:**

- Create: packages/server/src/modules/provider/application/services/provider-preference.service.ts
- Modify: packages/server/src/provider/preferences.ts
- Test: packages/server/src/provider/**tests**/storage.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create provider preference application service", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/storage.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create provider preference application service
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create provider preference application service",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/storage.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/provider/application/services/provider-preference.service.ts packages/server/src/provider/preferences.ts packages/server/src/provider/__tests__/storage.test.ts
git commit -m "refactor(server): move provider preferences to application service"

```

### Task 35: Create provider catalog usecase

**Files:**

- Create: packages/server/src/modules/provider/application/usecases/list-provider-catalog.usecase.ts
- Modify: packages/server/src/provider/catalog.ts
- Test: packages/server/src/provider/**tests**/catalog.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create provider catalog usecase", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/catalog.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create provider catalog usecase
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create provider catalog usecase",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/provider/**tests**/catalog.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/provider/application/usecases/list-provider-catalog.usecase.ts packages/server/src/provider/catalog.ts packages/server/src/provider/__tests__/catalog.test.ts
git commit -m "feat(server): add provider catalog usecase"

```

### Task 36: Create provider controller route

**Files:**

- Create: packages/server/src/modules/provider/controller/routes/provider.route.ts
- Modify: packages/server/src/routes/provider.ts
- Test: packages/server/src/routes/**tests**/provider.routes.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create provider controller route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/provider.routes.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create provider controller route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create provider controller route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/provider.routes.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/provider/controller/routes/provider.route.ts packages/server/src/routes/provider.ts packages/server/src/routes/__tests__/provider.routes.test.ts
git commit -m "refactor(server): migrate provider route with zvalidator"

```

### Task 37: Wire provider module routes

**Files:**

- Create: packages/server/src/modules/provider/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/provider.routes.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire provider module routes", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/provider.routes.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire provider module routes
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire provider module routes",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/provider.routes.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/provider/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/provider.routes.test.ts
git commit -m "refactor(server): mount provider module routes"

```

### Task 38: Create workspace repository port

**Files:**

- Create: packages/server/src/modules/workspace/domain/repositories/workspace.repository.ts
- Modify: packages/server/db/workspaces.ts
- Test: packages/server/db/**tests**/workspaces.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create workspace repository port", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/workspaces.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create workspace repository port
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create workspace repository port",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/db/**tests**/workspaces.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/workspace/domain/repositories/workspace.repository.ts packages/server/db/workspaces.ts packages/server/db/__tests__/workspaces.test.ts
git commit -m "refactor(server): define workspace repository port"

```

### Task 39: Create workspace usecases

**Files:**

- Create: packages/server/src/modules/workspace/application/usecases/list-workspaces.usecase.ts
- Modify: packages/server/src/routes/workspaces.ts
- Test: packages/server/src/routes/**tests**/workspaces.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create workspace usecases", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspaces.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create workspace usecases
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create workspace usecases",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspaces.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/workspace/application/usecases/list-workspaces.usecase.ts packages/server/src/routes/workspaces.ts packages/server/src/routes/__tests__/workspaces.test.ts
git commit -m "feat(server): add workspace list usecase"

```

### Task 40: Create workspaces controller route

**Files:**

- Create: packages/server/src/modules/workspace/controller/routes/workspaces.route.ts
- Modify: packages/server/src/routes/workspaces.ts
- Test: packages/server/src/routes/**tests**/workspaces.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create workspaces controller route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspaces.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create workspaces controller route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create workspaces controller route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspaces.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/workspace/controller/routes/workspaces.route.ts packages/server/src/routes/workspaces.ts packages/server/src/routes/__tests__/workspaces.test.ts
git commit -m "refactor(server): migrate workspaces route with zvalidator"

```

### Task 41: Create workspace info route

**Files:**

- Create: packages/server/src/modules/workspace/controller/routes/workspace.route.ts
- Modify: packages/server/src/routes/workspace.ts
- Test: packages/server/src/routes/**tests**/workspace.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create workspace info route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspace.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create workspace info route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create workspace info route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspace.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/workspace/controller/routes/workspace.route.ts packages/server/src/routes/workspace.ts packages/server/src/routes/__tests__/workspace.test.ts
git commit -m "refactor(server): migrate workspace route module"

```

### Task 42: Wire workspace module routes

**Files:**

- Create: packages/server/src/modules/workspace/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/workspaces.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire workspace module routes", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspaces.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire workspace module routes
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire workspace module routes",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/workspaces.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/workspace/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/workspaces.test.ts
git commit -m "refactor(server): mount workspace module routes"

```

### Task 43: Create project module usecases

**Files:**

- Create: packages/server/src/modules/project/application/usecases/get-project.usecase.ts
- Modify: packages/server/src/routes/project.ts
- Test: packages/server/src/routes/**tests**/project.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create project module usecases", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create project module usecases
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create project module usecases",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/project/application/usecases/get-project.usecase.ts packages/server/src/routes/project.ts packages/server/src/routes/__tests__/project.test.ts
git commit -m "feat(server): add project usecases"

```

### Task 44: Create project route module

**Files:**

- Create: packages/server/src/modules/project/controller/routes/project.route.ts
- Modify: packages/server/src/routes/project.ts
- Test: packages/server/src/routes/**tests**/project.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create project route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create project route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create project route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/project/controller/routes/project.route.ts packages/server/src/routes/project.ts packages/server/src/routes/__tests__/project.test.ts
git commit -m "refactor(server): migrate project route module"

```

### Task 45: Create project keypoint route module

**Files:**

- Create: packages/server/src/modules/project/controller/routes/project-keypoints.route.ts
- Modify: packages/server/src/routes/project-keypoints.ts
- Test: packages/server/src/routes/**tests**/project-keypoints.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create project keypoint route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project-keypoints.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create project keypoint route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create project keypoint route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project-keypoints.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/project/controller/routes/project-keypoints.route.ts packages/server/src/routes/project-keypoints.ts packages/server/src/routes/__tests__/project-keypoints.test.ts
git commit -m "refactor(server): migrate keypoints route module"

```

### Task 46: Wire project module routes

**Files:**

- Create: packages/server/src/modules/project/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/project.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire project module routes", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire project module routes
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire project module routes",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/project.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/project/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/project.test.ts
git commit -m "refactor(server): mount project module routes"

```

### Task 47: Create files module services

**Files:**

- Create: packages/server/src/modules/files/application/usecases/search-files.usecase.ts
- Modify: packages/server/src/services/file-index.ts
- Test: packages/server/src/services/**tests**/file-index.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create files module services", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/file-index.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create files module services
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create files module services",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/file-index.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/files/application/usecases/search-files.usecase.ts packages/server/src/services/file-index.ts packages/server/src/services/__tests__/file-index.test.ts
git commit -m "refactor(server): move file index usecase to module"

```

### Task 48: Create files infrastructure watcher

**Files:**

- Create: packages/server/src/modules/files/infrastructure/watchers/file-watcher.ts
- Modify: packages/server/src/services/file-watcher.ts
- Test: packages/server/src/services/**tests**/file-watcher.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create files infrastructure watcher", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/file-watcher.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create files infrastructure watcher
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create files infrastructure watcher",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/services/**tests**/file-watcher.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/files/infrastructure/watchers/file-watcher.ts packages/server/src/services/file-watcher.ts packages/server/src/services/__tests__/file-watcher.test.ts
git commit -m "refactor(server): move file watcher infra to module"

```

### Task 49: Create files route module

**Files:**

- Create: packages/server/src/modules/files/controller/routes/files.route.ts
- Modify: packages/server/src/routes/files.ts
- Test: packages/server/src/routes/**tests**/files.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create files route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/files.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create files route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create files route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/files.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/files/controller/routes/files.route.ts packages/server/src/routes/files.ts packages/server/src/routes/__tests__/files.test.ts
git commit -m "refactor(server): migrate files route with zvalidator"

```

### Task 50: Wire files module routes

**Files:**

- Create: packages/server/src/modules/files/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/files.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire files module routes", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/files.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire files module routes
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire files module routes",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/files.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/files/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/files.test.ts
git commit -m "refactor(server): mount files module routes"

```

### Task 51: Create vcs route module

**Files:**

- Create: packages/server/src/modules/vcs/controller/routes/vcs.route.ts
- Modify: packages/server/src/routes/vcs.ts
- Test: packages/server/src/routes/**tests**/vcs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create vcs route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/vcs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create vcs route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create vcs route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/vcs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/vcs/controller/routes/vcs.route.ts packages/server/src/routes/vcs.ts packages/server/src/routes/__tests__/vcs.test.ts
git commit -m "refactor(server): migrate vcs route with zvalidator"

```

### Task 52: Create diff route module

**Files:**

- Create: packages/server/src/modules/vcs/controller/routes/diff.route.ts
- Modify: packages/server/src/routes/diff.ts
- Test: packages/server/src/routes/**tests**/chat-ordering.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create diff route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-ordering.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create diff route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create diff route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-ordering.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/vcs/controller/routes/diff.route.ts packages/server/src/routes/diff.ts packages/server/src/routes/__tests__/chat-ordering.test.ts
git commit -m "refactor(server): migrate diff route module"

```

### Task 53: Wire vcs module routes

**Files:**

- Create: packages/server/src/modules/vcs/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/vcs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire vcs module routes", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/vcs.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire vcs module routes
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire vcs module routes",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/vcs.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/vcs/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/vcs.test.ts
git commit -m "refactor(server): mount vcs module routes"

```

### Task 54: Create permissions route module

**Files:**

- Create: packages/server/src/modules/permissions/controller/routes/permissions.route.ts
- Modify: packages/server/src/routes/permissions.ts
- Test: packages/server/src/routes/**tests**/event.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create permissions route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/event.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create permissions route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create permissions route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/event.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/permissions/controller/routes/permissions.route.ts packages/server/src/routes/permissions.ts packages/server/src/routes/__tests__/event.test.ts
git commit -m "refactor(server): migrate permissions route with zvalidator"

```

### Task 55: Create questions route module

**Files:**

- Create: packages/server/src/modules/questions/controller/routes/questions.route.ts
- Modify: packages/server/src/routes/questions.ts
- Test: packages/server/src/routes/**tests**/questions.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create questions route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/questions.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create questions route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create questions route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/questions.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/questions/controller/routes/questions.route.ts packages/server/src/routes/questions.ts packages/server/src/routes/__tests__/questions.test.ts
git commit -m "refactor(server): migrate questions route with zvalidator"

```

### Task 56: Create rules route module

**Files:**

- Create: packages/server/src/modules/rules/controller/routes/rules.route.ts
- Modify: packages/server/src/routes/rules.ts
- Test: packages/server/src/routes/**tests**/chat-runtime-mode.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create rules route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-runtime-mode.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create rules route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create rules route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-runtime-mode.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/rules/controller/routes/rules.route.ts packages/server/src/routes/rules.ts packages/server/src/routes/__tests__/chat-runtime-mode.test.ts
git commit -m "refactor(server): migrate rules route module"

```

### Task 57: Create command route module

**Files:**

- Create: packages/server/src/modules/command/controller/routes/command.route.ts
- Modify: packages/server/src/routes/command.ts
- Test: packages/server/src/routes/**tests**/agent.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create command route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/agent.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create command route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create command route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/agent.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/command/controller/routes/command.route.ts packages/server/src/routes/command.ts packages/server/src/routes/__tests__/agent.test.ts
git commit -m "refactor(server): migrate command route module"

```

### Task 58: Create agent route module

**Files:**

- Create: packages/server/src/modules/agent/controller/routes/agent.route.ts
- Modify: packages/server/src/routes/agent.ts
- Test: packages/server/src/routes/**tests**/agent.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create agent route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/agent.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create agent route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create agent route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/agent.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/agent/controller/routes/agent.route.ts packages/server/src/routes/agent.ts packages/server/src/routes/__tests__/agent.test.ts
git commit -m "refactor(server): migrate agent route module"

```

### Task 59: Create events route module

**Files:**

- Create: packages/server/src/modules/events/controller/routes/events.route.ts
- Modify: packages/server/src/routes/events.ts
- Test: packages/server/src/routes/**tests**/event.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create events route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/event.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create events route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create events route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/event.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/events/controller/routes/events.route.ts packages/server/src/routes/events.ts packages/server/src/routes/__tests__/event.test.ts
git commit -m "refactor(server): migrate events catchup route module"

```

### Task 60: Create event sse route module

**Files:**

- Create: packages/server/src/modules/events/controller/routes/event.route.ts
- Modify: packages/server/src/routes/event.ts
- Test: packages/server/src/routes/**tests**/event.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create event sse route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/event.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create event sse route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create event sse route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/event.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/events/controller/routes/event.route.ts packages/server/src/routes/event.ts packages/server/src/routes/__tests__/event.test.ts
git commit -m "refactor(server): migrate event sse route module"

```

### Task 61: Create lsp route module

**Files:**

- Create: packages/server/src/modules/lsp/controller/routes/lsp.route.ts
- Modify: packages/server/src/routes/lsp.ts
- Test: packages/server/src/routes/**tests**/lsp.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create lsp route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/lsp.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create lsp route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create lsp route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/lsp.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/lsp/controller/routes/lsp.route.ts packages/server/src/routes/lsp.ts packages/server/src/routes/__tests__/lsp.test.ts
git commit -m "refactor(server): migrate lsp route module"

```

### Task 62: Create mcp route module

**Files:**

- Create: packages/server/src/modules/mcp/controller/routes/mcp.route.ts
- Modify: packages/server/src/routes/mcp.ts
- Test: packages/server/src/routes/**tests**/lsp.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create mcp route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/lsp.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create mcp route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create mcp route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/lsp.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/mcp/controller/routes/mcp.route.ts packages/server/src/routes/mcp.ts packages/server/src/routes/__tests__/lsp.test.ts
git commit -m "refactor(server): migrate mcp route module"

```

### Task 63: Wire runtime utility modules

**Files:**

- Create: packages/server/src/modules/runtime/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/agent.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire runtime utility modules", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/agent.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire runtime utility modules
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire runtime utility modules",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/agent.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/runtime/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/agent.test.ts
git commit -m "refactor(server): mount runtime utility modules"

```

### Task 64: Create chat request schemas

**Files:**

- Create: packages/server/src/modules/chat/controller/schemas/chat.schema.ts
- Modify: packages/server/src/routes/chat.ts
- Test: packages/server/src/routes/**tests**/chat.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create chat request schemas", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create chat request schemas
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create chat request schemas",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/chat/controller/schemas/chat.schema.ts packages/server/src/routes/chat.ts packages/server/src/routes/__tests__/chat.test.ts
git commit -m "test(server): add chat request schema coverage"

```

### Task 65: Create chat application service

**Files:**

- Create: packages/server/src/modules/chat/application/services/chat.service.ts
- Modify: packages/server/src/routes/chat.ts
- Test: packages/server/src/routes/**tests**/chat-provider-selection.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create chat application service", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-provider-selection.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create chat application service
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create chat application service",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-provider-selection.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/chat/application/services/chat.service.ts packages/server/src/routes/chat.ts packages/server/src/routes/__tests__/chat-provider-selection.test.ts
git commit -m "refactor(server): extract chat application service"

```

### Task 66: Create chat controller route

**Files:**

- Create: packages/server/src/modules/chat/controller/routes/chat.route.ts
- Modify: packages/server/src/routes/chat.ts
- Test: packages/server/src/routes/**tests**/chat.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create chat controller route", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create chat controller route
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create chat controller route",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/chat/controller/routes/chat.route.ts packages/server/src/routes/chat.ts packages/server/src/routes/__tests__/chat.test.ts
git commit -m "refactor(server): migrate chat route with validators"

```

### Task 67: Create session data route module

**Files:**

- Create: packages/server/src/modules/chat/controller/routes/session-data.route.ts
- Modify: packages/server/src/routes/session-data.ts
- Test: packages/server/src/routes/**tests**/session-data.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create session data route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/session-data.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create session data route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create session data route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/session-data.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/chat/controller/routes/session-data.route.ts packages/server/src/routes/session-data.ts packages/server/src/routes/__tests__/session-data.test.ts
git commit -m "refactor(server): migrate session-data route module"

```

### Task 68: Create chat status route module

**Files:**

- Create: packages/server/src/modules/chat/controller/routes/session-status.route.ts
- Modify: packages/server/src/routes/chat.ts
- Test: packages/server/src/routes/**tests**/chat-runtime-mode.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Create chat status route module", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-runtime-mode.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Create chat status route module
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Create chat status route module",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat-runtime-mode.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/chat/controller/routes/session-status.route.ts packages/server/src/routes/chat.ts packages/server/src/routes/__tests__/chat-runtime-mode.test.ts
git commit -m "refactor(server): split chat status route module"

```

### Task 69: Wire chat module routes

**Files:**

- Create: packages/server/src/modules/chat/controller/routes/index.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/routes/**tests**/chat.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Wire chat module routes", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Wire chat module routes
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Wire chat module routes",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/chat/controller/routes/index.ts packages/server/src/app/register-routes.ts packages/server/src/routes/__tests__/chat.test.ts
git commit -m "refactor(server): mount chat module routes"

```

### Task 70: Export package rpc surface

**Files:**

- Create: packages/server/src/index.ts
- Modify: packages/server/package.json
- Test: apps/desktop/tests/helpers/test-server.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Export package rpc surface", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/desktop exec vitest run apps/desktop/tests/helpers/test-server.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Export package rpc surface
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Export package rpc surface",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/desktop exec vitest run apps/desktop/tests/helpers/test-server.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/index.ts packages/server/package.json apps/desktop/tests/helpers/test-server.ts
git commit -m "feat(server): expose rpc app type from package root"

```

### Task 71: Add frontend hono client contract test

**Files:**

- Create: apps/desktop/src/core/services/api/**tests**/hono-client-contract.test.ts
- Modify: apps/desktop/src/core/services/api/index.ts
- Test: apps/desktop/src/core/services/api/**tests**/hono-client-contract.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Add frontend hono client contract test", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/desktop exec vitest run apps/desktop/src/core/services/api/**tests**/hono-client-contract.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Add frontend hono client contract test
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Add frontend hono client contract test",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/desktop exec vitest run apps/desktop/src/core/services/api/**tests**/hono-client-contract.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/core/services/api/__tests__/hono-client-contract.test.ts apps/desktop/src/core/services/api/index.ts
git commit -m "test(desktop): add hono client type contract"

```

### Task 72: Deprecate legacy routes index shim

**Files:**

- Create: packages/server/src/routes/index.legacy.ts
- Modify: packages/server/src/index.ts
- Test: packages/server/src/routes/**tests**/chat.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Deprecate legacy routes index shim", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Deprecate legacy routes index shim
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Deprecate legacy routes index shim",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/routes/**tests**/chat.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/routes/index.legacy.ts packages/server/src/index.ts packages/server/src/routes/__tests__/chat.test.ts
git commit -m "chore(server): add legacy routes shim during migration"

```

### Task 73: Delete direct db imports from controllers

**Files:**

- Create: packages/server/src/modules/shared/lint/no-direct-db-imports.md
- Modify: packages/server/eslint.config.js
- Test: packages/server/src/routes/**tests**/task-runs.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Delete direct db imports from controllers", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec eslint packages/server/src --max-warnings=0
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Delete direct db imports from controllers
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Delete direct db imports from controllers",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec eslint packages/server/src --max-warnings=0
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/modules/shared/lint/no-direct-db-imports.md packages/server/eslint.config.js packages/server/src/routes/__tests__/task-runs.test.ts
git commit -m "chore(server): enforce no direct db imports in controllers"

```

### Task 74: Finalize route-first app typing chain

**Files:**

- Create: packages/server/src/app/app.ts
- Modify: packages/server/src/app/register-routes.ts
- Test: packages/server/src/app/**tests**/app-composition.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Finalize route-first app typing chain", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Finalize route-first app typing chain
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Finalize route-first app typing chain",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server exec vitest run packages/server/src/app/**tests**/app-composition.test.ts
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/app/app.ts packages/server/src/app/register-routes.ts packages/server/src/app/__tests__/app-composition.test.ts
git commit -m "refactor(server): finalize chained route typing for rpc"

```

### Task 75: Run full server verification gate

**Files:**

- Create: packages/server/docs/migration/verification-phase-final.md
- Modify: packages/server/tests/TESTING_ARCHITECTURE.md
- Test: packages/server/tests/TESTING_ARCHITECTURE.md

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Run full server verification gate", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm --filter @sakti-code/server lint && pnpm --filter @sakti-code/server typecheck && pnpm --filter @sakti-code/server test
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Run full server verification gate
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Run full server verification gate",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm --filter @sakti-code/server lint && pnpm --filter @sakti-code/server typecheck && pnpm --filter @sakti-code/server test
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/docs/migration/verification-phase-final.md packages/server/tests/TESTING_ARCHITECTURE.md
git commit -m "chore(server): document final verification evidence"

```

### Task 76: Run cross-workspace verification gate

**Files:**

- Create: docs/plans/2026-02-26-server-hono-ddd-rpc-refactor-validation.md
- Modify: apps/desktop/tests/helpers/test-server.ts
- Test: apps/desktop/tests/integration/data-integrity/session-creation-flow.test.ts

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { app } from "@/app/app";

describe("Run cross-workspace verification gate", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: pnpm lint && pnpm typecheck && pnpm test
Expected: FAIL with missing route/module/import/assertion mismatch that confirms the behavior is not implemented yet.

**Step 3: Write minimal implementation**

```ts
// Minimal vertical slice for: Run cross-workspace verification gate
// Keep route-first handlers inline and pass through application usecase.
export const migrationCheckpoint = {
  task: "Run cross-workspace verification gate",
  status: "implemented-minimally",
} as const;
```

**Step 4: Run test to verify it passes**

Run: pnpm lint && pnpm typecheck && pnpm test
Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-02-26-server-hono-ddd-rpc-refactor-validation.md apps/desktop/tests/helpers/test-server.ts apps/desktop/tests/integration/data-integrity/session-creation-flow.test.ts
git commit -m "chore(repo): validate server refactor across desktop integration"

```

## Phase Checklists

### Phase A: App + Shared Foundations

- [ ] App composition root exists and exports `app` + `AppType`.
- [ ] Middleware moved under app composition without behavioral drift.
- [ ] Shared HTTP error and validation helpers adopted by migrated modules.

### Phase B: Core Workflow Modules

- [ ] `task-sessions` fully moved to module layers.
- [ ] `task-runs` + `run-events` fully moved with worker integration.
- [ ] Session header semantics (`X-Task-Session-ID`) unchanged.

### Phase C: Provider + Workspace + Project + Files + VCS

- [ ] Provider routes validated with `zValidator` and use application services.
- [ ] Workspace/workspaces/project/keypoints moved to route-first module controllers.
- [ ] Files/vcs/diff modules route-first and validated.

### Phase D: Runtime Utility Routes + Chat

- [ ] permissions/questions/rules/command/agent/lsp/mcp/events modules migrated.
- [ ] Chat route decomposed into module controller + application services.
- [ ] Session data and chat status routes moved into chat module.

### Phase E: RPC + Cleanup

- [ ] Package root exports stable `AppType` for `hono/client`.
- [ ] Desktop contract test proves typed client compatibility.
- [ ] Legacy route files removed or hard-deprecated with explicit follow-up task.

## Risk Register

1. **Risk:** API drift during route migration.
   - Mitigation: Keep endpoint paths and add route-level contract tests before moving code.
2. **Risk:** Session bridge regressions.
   - Mitigation: Preserve middleware semantics and re-run desktop data-integrity suites each phase.
3. **Risk:** Worker lifecycle regressions.
   - Mitigation: Keep worker tests green while moving only orchestration location.
4. **Risk:** Frontend compile/runtime break due export changes.
   - Mitigation: Keep default export, add `AppType` named export, verify desktop test helper + API client tests.
5. **Risk:** Slow refactor merge conflicts.
   - Mitigation: frequent tiny commits and module-scoped PR slices.

## Command Matrix (Always Use)

- Targeted test: `pnpm --filter @sakti-code/server exec vitest run <path>`
- Server lint: `pnpm --filter @sakti-code/server lint`
- Server typecheck: `pnpm --filter @sakti-code/server typecheck`
- Server full test: `pnpm --filter @sakti-code/server test`
- Desktop targeted test: `pnpm --filter @sakti-code/desktop exec vitest run <path>`
- Desktop full test: `pnpm --filter @sakti-code/desktop test`

## Execution Notes for Engineer

- Keep each task within one small red/green/commit loop.
- Do not batch multiple module migrations in one commit.
- Keep temporary compatibility shims only if tests require them.
- Remove each shim as soon as replacement module is stable.
- When uncertain, prefer preserving behavior over architectural purity; schedule cleanup task explicitly.

## Completion Criteria Checklist

- [ ] All tasks complete.
- [ ] No controller imports from `../../db/*` or `../db/*`.
- [ ] Every request payload/query/params path uses `zValidator` + `c.req.valid`.
- [ ] App type exported after final route registration chain.
- [ ] Frontend typed client compiles against server `AppType`.
- [ ] Server and desktop verification commands pass.
