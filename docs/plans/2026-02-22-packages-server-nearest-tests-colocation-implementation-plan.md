# Packages Server Nearest `__tests__` Colocation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `packages/server` tests so domain tests live in nearest `src/**/__tests__/` (and `db/__tests__/` for DB modules), while only system-level suites remain centralized in `tests/integration/**` and `tests/e2e/**`.

**Architecture:** Use a staged hybrid migration: enable mixed discovery, re-home centralized integration contracts, migrate low-risk domains first, then routes/provider/db, then lock final discovery and add guardrails. Keep `tests/helpers/**`, `tests/fixtures/**` (if introduced), and `tests/vitest.setup.ts` centralized.

**Tech Stack:** TypeScript 5.9, Vitest 4, pnpm workspace, ESLint 9, existing `@/` alias, Hono routes, Drizzle DB modules.

---

## Scope

- In scope:
  - Move tests from `packages/server/tests/**` into nearest source ownership locations.
  - Use `packages/server/db/__tests__/` for DB-layer tests.
  - Keep centralized:
    - `packages/server/tests/integration/**`
    - `packages/server/tests/e2e/**` (create if needed)
    - `packages/server/tests/helpers/**`
    - `packages/server/tests/vitest.setup.ts`
  - Update Vitest/TypeScript discovery and add regression guardrails.
- Out of scope:
  - `@/` to `#*` subpath import migration.
  - Broad route/provider architecture redesign.
  - Non-test production refactors unless required for compilation.

## Preconditions

1. Work in a dedicated worktree branch.
2. Ensure dependencies installed:
   - `pnpm install`
3. Capture baseline:
   - `pnpm --filter @sakti-code/server run typecheck`
   - `pnpm --filter @sakti-code/server run lint`
   - `pnpm --filter @sakti-code/server run test`

Use `@systematic-debugging` if any expected-stable batch fails unexpectedly.

---

### Task 1: Enable Transitional Mixed Test Discovery

**Files:**

- Modify: `packages/server/vitest.config.ts`
- Create: `packages/server/tsconfig.spec.json`
- Modify: `packages/server/package.json`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run "db/__tests__/**/*.test.ts" --passWithNoTests=false
```

**Step 2: Run test to verify it fails**

Expected: FAIL (no `db/__tests__` include / missing files).

**Step 3: Write minimal implementation**

- Update Vitest config `test.include` to support mixed layout:
  - `src/**/__tests__/**/*.test.ts`
  - `db/__tests__/**/*.test.ts`
  - `tests/**/*.test.ts` (temporary during migration)
- Keep `setupFiles: ["./tests/vitest.setup.ts"]`.
- Add `tsconfig.spec.json` dedicated to test typechecking including:
  - `src/**/*`
  - `db/**/*`
  - `tests/**/*`
- Add package script:
  - `"test:typecheck": "tsc -p tsconfig.spec.json --noEmit"`

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/server run test:typecheck
pnpm --filter @sakti-code/server run test
```

Expected: PASS with mixed discovery.

**Step 5: Commit**

```bash
git add packages/server/vitest.config.ts packages/server/tsconfig.spec.json packages/server/package.json
git commit -m "test(server): enable transitional mixed test discovery"
```

---

### Task 2: Re-home Centralized Integration Contract Suites

**Files:**

- Move:
  - `packages/server/tests/routes/provider-e2e.test.ts` -> `packages/server/tests/integration/provider-e2e.test.ts`
  - `packages/server/tests/plugin/hooks.test.ts` -> `packages/server/tests/integration/plugin-hooks.contract.test.ts`
  - `packages/server/tests/spec/parser.test.ts` -> `packages/server/tests/integration/core-spec-parser.contract.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run tests/integration/provider-e2e.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before file move.

**Step 3: Write minimal implementation**

Move files with `git mv` and normalize imports to `@/` where needed.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run tests/integration
```

Expected: PASS for integration suite paths.

**Step 5: Commit**

```bash
git add packages/server/tests/integration packages/server/tests/routes packages/server/tests/plugin packages/server/tests/spec
git commit -m "test(server): centralize integration contract suites under tests/integration"
```

---

### Task 3: Move Low-Risk Shared/Bus/State Tests to Nearest `__tests__`

**Files:**

- Move:
  - `packages/server/tests/routes/_shared/directory-resolver.test.ts` -> `packages/server/src/routes/_shared/__tests__/directory-resolver.test.ts`
  - `packages/server/tests/routes/_shared/pagination.test.ts` -> `packages/server/src/routes/_shared/__tests__/pagination.test.ts`
  - `packages/server/tests/bus/bus.test.ts` -> `packages/server/src/bus/__tests__/bus.test.ts`
  - `packages/server/tests/bus/task-events.test.ts` -> `packages/server/src/bus/__tests__/task-events.test.ts`
  - `packages/server/tests/contracts/event-payloads.test.ts` -> `packages/server/src/bus/__tests__/event-payloads.contract.test.ts`
  - `packages/server/tests/state/session-message-store.test.ts` -> `packages/server/src/state/__tests__/session-message-store.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run src/bus/__tests__/bus.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before move.

**Step 3: Write minimal implementation**

Move files with `git mv`; replace deep relative imports with `@/` imports.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run \
  src/routes/_shared/__tests__/directory-resolver.test.ts \
  src/bus/__tests__/bus.test.ts \
  src/bus/__tests__/event-payloads.contract.test.ts \
  src/state/__tests__/session-message-store.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/_shared packages/server/src/bus packages/server/src/state packages/server/tests/routes/_shared packages/server/tests/bus packages/server/tests/contracts packages/server/tests/state
git commit -m "test(server): colocate shared bus and state tests"
```

---

### Task 4: Move Middleware and Route Suites

**Files:**

- Move middleware:
  - `packages/server/tests/middleware/auth.test.ts` -> `packages/server/src/middleware/__tests__/auth.test.ts`
  - `packages/server/tests/middleware/cache.test.ts` -> `packages/server/src/middleware/__tests__/cache.test.ts`
  - `packages/server/tests/middleware/error-handler.test.ts` -> `packages/server/src/middleware/__tests__/error-handler.test.ts`
  - `packages/server/tests/middleware/rate-limit.test.ts` -> `packages/server/src/middleware/__tests__/rate-limit.test.ts`
  - `packages/server/tests/middleware/session-bridge.test.ts` -> `packages/server/src/middleware/__tests__/session-bridge.test.ts`
- Move routes:
  - `packages/server/tests/routes/agent.test.ts` -> `packages/server/src/routes/__tests__/agent.test.ts`
  - `packages/server/tests/routes/chat-provider-selection.test.ts` -> `packages/server/src/routes/__tests__/chat-provider-selection.test.ts`
  - `packages/server/tests/routes/chat.test.ts` -> `packages/server/src/routes/__tests__/chat.test.ts`
  - `packages/server/tests/routes/event.test.ts` -> `packages/server/src/routes/__tests__/event.test.ts`
  - `packages/server/tests/routes/health.test.ts` -> `packages/server/src/routes/__tests__/health.test.ts`
  - `packages/server/tests/routes/lsp.test.ts` -> `packages/server/src/routes/__tests__/lsp.test.ts`
  - `packages/server/tests/routes/project.test.ts` -> `packages/server/src/routes/__tests__/project.test.ts`
  - `packages/server/tests/routes/provider.routes.test.ts` -> `packages/server/src/routes/__tests__/provider.routes.test.ts`
  - `packages/server/tests/routes/session-data.test.ts` -> `packages/server/src/routes/__tests__/session-data.test.ts`
  - `packages/server/tests/routes/tasks.test.ts` -> `packages/server/src/routes/__tests__/tasks.test.ts`
  - `packages/server/tests/routes/vcs.test.ts` -> `packages/server/src/routes/__tests__/vcs.test.ts`
  - `packages/server/tests/routes/workspace.test.ts` -> `packages/server/src/routes/__tests__/workspace.test.ts`
  - `packages/server/tests/routes/workspaces.test.ts` -> `packages/server/src/routes/__tests__/workspaces.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run src/routes/__tests__/chat.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before move.

**Step 3: Write minimal implementation**

Move with `git mv`; update imports to `@/` and `@/../db` equivalents as needed.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run src/middleware/__tests__ src/routes/__tests__
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/middleware packages/server/src/routes packages/server/tests/middleware packages/server/tests/routes
git commit -m "test(server): colocate middleware and route suites"
```

---

### Task 5: Move Provider Domain Suites to Nearest `__tests__`

**Files:**

- Move provider root:
  - `packages/server/tests/provider/bootstrap.test.ts` -> `packages/server/src/provider/__tests__/bootstrap.test.ts`
  - `packages/server/tests/provider/capabilities.test.ts` -> `packages/server/src/provider/__tests__/capabilities.test.ts`
  - `packages/server/tests/provider/catalog.test.ts` -> `packages/server/src/provider/__tests__/catalog.test.ts`
  - `packages/server/tests/provider/errors.test.ts` -> `packages/server/src/provider/__tests__/errors.test.ts`
  - `packages/server/tests/provider/registry.test.ts` -> `packages/server/src/provider/__tests__/registry.test.ts`
  - `packages/server/tests/provider/schema.test.ts` -> `packages/server/src/provider/__tests__/schema.test.ts`
  - `packages/server/tests/provider/storage.test.ts` -> `packages/server/src/provider/__tests__/storage.test.ts`
- Move provider adapters:
  - `packages/server/tests/provider/anthropic-adapter.test.ts` -> `packages/server/src/provider/adapters/__tests__/anthropic-adapter.test.ts`
  - `packages/server/tests/provider/openai-adapter.test.ts` -> `packages/server/src/provider/adapters/__tests__/openai-adapter.test.ts`
- Move provider auth:
  - `packages/server/tests/provider/auth.providers.test.ts` -> `packages/server/src/provider/auth/providers/__tests__/providers.test.ts`
  - `packages/server/tests/provider/auth.registry.test.ts` -> `packages/server/src/provider/auth/__tests__/registry.test.ts`
  - `packages/server/tests/provider/auth.service.test.ts` -> `packages/server/src/provider/auth/__tests__/service.test.ts`
  - `packages/server/tests/provider/oauth.copilot.test.ts` -> `packages/server/src/provider/auth/__tests__/oauth.copilot.test.ts`
  - `packages/server/tests/provider/oauth.openai.test.ts` -> `packages/server/src/provider/auth/__tests__/oauth.openai.test.ts`
  - `packages/server/tests/provider/oauth.refresh.test.ts` -> `packages/server/src/provider/auth/__tests__/oauth.refresh.test.ts`
- Move provider models:
  - `packages/server/tests/provider/alias-catalog.test.ts` -> `packages/server/src/provider/models/__tests__/alias-catalog.test.ts`
  - `packages/server/tests/provider/models-snapshot.test.ts` -> `packages/server/src/provider/models/__tests__/models-snapshot.test.ts`
  - `packages/server/tests/provider/update-models-snapshot.test.ts` -> `packages/server/src/provider/models/__tests__/update-models-snapshot.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run src/provider/__tests__/registry.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before move.

**Step 3: Write minimal implementation**

Move files via `git mv` to exact paths above and normalize imports.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run src/provider
```

Expected: PASS for provider suite.

**Step 5: Commit**

```bash
git add packages/server/src/provider packages/server/tests/provider
git commit -m "test(server): colocate provider domain suites under nearest __tests__"
```

---

### Task 6: Move DB Suites to `db/__tests__/`

**Files:**

- Move:
  - `packages/server/tests/db/index.test.ts` -> `packages/server/db/__tests__/index.test.ts`
  - `packages/server/tests/db/memory-migration-upgrade.test.ts` -> `packages/server/db/__tests__/memory-migration-upgrade.test.ts`
  - `packages/server/tests/db/memory-schema.test.ts` -> `packages/server/db/__tests__/memory-schema.test.ts`
  - `packages/server/tests/db/migrate.test.ts` -> `packages/server/db/__tests__/migrate.test.ts`
  - `packages/server/tests/db/migration-policy.test.ts` -> `packages/server/db/__tests__/migration-policy.test.ts`
  - `packages/server/tests/db/sessions.test.ts` -> `packages/server/db/__tests__/sessions.test.ts`
  - `packages/server/tests/db/tool-sessions.test.ts` -> `packages/server/db/__tests__/tool-sessions.test.ts`
  - `packages/server/tests/db/workspaces.test.ts` -> `packages/server/db/__tests__/workspaces.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run db/__tests__/index.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before move.

**Step 3: Write minimal implementation**

Move with `git mv`; update imports from `../../db/*` to nearest relative paths in `db/__tests__`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/server exec vitest run db/__tests__
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/db/__tests__ packages/server/tests/db
git commit -m "test(server): colocate db suites under db/__tests__"
```

---

### Task 7: Lock Final Discovery and Add Legacy-Layout Guardrail

**Files:**

- Create: `packages/server/scripts/check-no-legacy-domain-tests.sh`
- Modify: `packages/server/package.json`
- Modify: `packages/server/vitest.config.ts`

**Step 1: Write the failing test**

Create guardrail script:

```bash
#!/usr/bin/env bash
set -euo pipefail
if rg --files packages/server/tests/{bus,contracts,db,middleware,migration,plugin,provider,routes,spec,state} -g "*.test.ts" | grep -q .; then
  echo "Found forbidden legacy domain test files under packages/server/tests/*"
  exit 1
fi
```

**Step 2: Run test to verify it fails**

Run:

```bash
bash packages/server/scripts/check-no-legacy-domain-tests.sh
```

Expected: FAIL until migration complete.

**Step 3: Write minimal implementation**

- Update Vitest include to final:
  - `src/**/__tests__/**/*.test.ts`
  - `db/__tests__/**/*.test.ts`
  - `tests/integration/**/*.test.ts`
  - `tests/e2e/**/*.test.ts`
- Add script:
  - `"test:layout": "bash ./scripts/check-no-legacy-domain-tests.sh"`
- Remove empty legacy domain directories under `tests/*` once files moved.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/server run test:layout
pnpm --filter @sakti-code/server run test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/scripts/check-no-legacy-domain-tests.sh packages/server/package.json packages/server/vitest.config.ts packages/server/tests
git commit -m "test(server): enforce nearest __tests__ and db/__tests__ layout"
```

---

### Task 8: Update Test Architecture Documentation

**Files:**

- Create: `packages/server/tests/TESTING_ARCHITECTURE.md`

**Step 1: Write the failing test**

N/A doc task; verify absence/obsolescence first:

```bash
test -f packages/server/tests/TESTING_ARCHITECTURE.md && echo "exists" || echo "missing"
```

**Step 2: Run test to verify it fails**

Expected: missing or outdated.

**Step 3: Write minimal implementation**

Document final conventions:

- nearest `src/**/__tests__/`
- DB tests in `db/__tests__/`
- only system suites in `tests/integration` and `tests/e2e`
- centralized helpers/setup retained
- required verification command matrix

**Step 4: Run test to verify it passes**

Run:

```bash
rg -n "src/\\*\\*/__tests__|db/__tests__|tests/integration|test:layout" packages/server/tests/TESTING_ARCHITECTURE.md
```

Expected: key policy markers present.

**Step 5: Commit**

```bash
git add packages/server/tests/TESTING_ARCHITECTURE.md
git commit -m "docs(server-tests): document nearest __tests__ testing architecture"
```

---

### Task 9: Final Verification and Merge Readiness

**Files:**

- Modify: none expected (verification-only unless fixes required)

**Step 1: Write the failing test**

Run full gates:

```bash
pnpm --filter @sakti-code/server run test:typecheck
pnpm --filter @sakti-code/server run lint
pnpm --filter @sakti-code/server run test:layout
pnpm --filter @sakti-code/server run test
```

**Step 2: Run test to verify it fails**

Expected: Any residual failures become minimal follow-up fixes.

**Step 3: Write minimal implementation**

Apply only targeted fixes required for green gates.

**Step 4: Run test to verify it passes**

Re-run exact commands above; expected PASS.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore(server-tests): finalize nearest __tests__ colocation migration"
```

---

## End-State Acceptance Criteria

1. Domain tests live near source:
   - `packages/server/src/**/__tests__/`
   - `packages/server/db/__tests__/`
2. Centralized retained test dirs are only:
   - `packages/server/tests/integration/**`
   - `packages/server/tests/e2e/**`
   - `packages/server/tests/helpers/**`
   - `packages/server/tests/vitest.setup.ts`
3. No test files remain in legacy domain folders:
   - `tests/{bus,contracts,db,middleware,migration,plugin,provider,routes,spec,state}`
4. `pnpm --filter @sakti-code/server run test:typecheck` passes.
5. `pnpm --filter @sakti-code/server run lint` passes.
6. `pnpm --filter @sakti-code/server run test:layout` passes.
7. `pnpm --filter @sakti-code/server run test` passes.

## Notes for Execution

- Prefer `git mv` for every move to preserve history.
- Normalize deep relative imports to `@/` whenever possible.
- Keep integration/e2e suites centralized even when they touch one domain.
- Use `@verification-before-completion` before marking each task complete.
