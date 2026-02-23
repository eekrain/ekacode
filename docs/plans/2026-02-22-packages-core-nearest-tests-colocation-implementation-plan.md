# Packages Core Nearest `__tests__` Colocation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `packages/core` tests so unit/domain tests live in nearest `src/**/__tests__/`, while only system-level integration/e2e suites remain centralized under `tests/integration/**` and `tests/e2e/**`.

**Architecture:** Use a staged hybrid migration. First, stabilize discovery for mixed layout. Next, re-home integration-like suites into centralized integration buckets. Then migrate move-now tests to nearest `__tests__`. Finally, decouple DB-bridge-coupled suites from legacy `tests/` locations and colocate them safely. Keep `tests/helpers/**` and `tests/fixtures/**` centralized throughout.

**Tech Stack:** TypeScript 5.9, Vitest 4, pnpm workspace, ESLint 9, existing `@/` alias, `@sakti-code/core/testing/db` bridge.

---

## Scope

- In scope:
  - Move non-system tests from `packages/core/tests/**` into nearest `packages/core/src/**/__tests__/`.
  - Keep centralized:
    - `packages/core/tests/integration/**`
    - `packages/core/tests/e2e/**` (create if needed)
    - `packages/core/tests/helpers/**`
    - `packages/core/tests/fixtures/**`
    - `packages/core/tests/vitest.setup.ts`
  - Update Vitest and typecheck discovery for new layout.
  - Add guardrail to block reintroduction of `tests/<domain>/*.test.ts`.
- Out of scope:
  - `@/` to `#*` subpath migration.
  - Redesigning memory/spec/session runtime architecture.
  - Replacing centralized integration helpers/fixtures.

## Preconditions

1. Work in a dedicated worktree branch.
2. Ensure dependencies installed:
   - `pnpm install`
3. Baseline verification:
   - `pnpm --filter @sakti-code/core run test:typecheck`
   - `pnpm --filter @sakti-code/core run test:unit`
   - `pnpm --filter @sakti-code/core run test:integration`

Use `@systematic-debugging` when any batch introduces unexpected failures.

---

### Task 1: Stabilize Transitional Discovery (Mixed Layout)

**Files:**

- Modify: `packages/core/vitest.config.ts`
- Modify: `packages/core/tsconfig.spec.json`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run "src/**/__tests__/**/*.test.ts" --passWithNoTests=false
```

**Step 2: Run test to verify it fails**

Expected: FAIL with “No test files found” or missing include pattern.

**Step 3: Write minimal implementation**

- Update `packages/core/vitest.config.ts` include patterns to support both:
  - existing `tests/**/*.test.ts`
  - colocated `src/**/__tests__/**/*.test.ts`
- Keep setup file at `tests/vitest.setup.ts`.
- Update `packages/core/tsconfig.spec.json` include to cover test files in both `src/**/__tests__` and `tests/**`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core run test:typecheck
pnpm --filter @sakti-code/core run test:unit
```

Expected: PASS in mixed-layout mode.

**Step 5: Commit**

```bash
git add packages/core/vitest.config.ts packages/core/tsconfig.spec.json
git commit -m "test(core): enable transitional mixed test discovery"
```

---

### Task 2: Re-home Integration-Like Suites to Centralized Integration

**Files:**

- Move:
  - `packages/core/tests/agent/build-memory-tools.integration.test.ts` -> `packages/core/tests/integration/build-memory-tools.integration.test.ts`
  - `packages/core/tests/tools/integration/instance-context-integration.test.ts` -> `packages/core/tests/integration/instance-context-integration.test.ts`
  - `packages/core/tests/memory/observation/integration.test.ts` -> `packages/core/tests/integration/memory-observation.integration.test.ts`
  - `packages/core/tests/memory/observation/phase5-end-to-end.test.ts` -> `packages/core/tests/integration/memory-observation-phase5-end-to-end.test.ts`
  - `packages/core/tests/memory/observation/phase5-integration-flow.test.ts` -> `packages/core/tests/integration/memory-observation-phase5-flow.integration.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run tests/integration/build-memory-tools.integration.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file not found before move).

**Step 3: Write minimal implementation**

Move files via `git mv` to paths above and fix local relative imports to `@/` aliases where needed.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run tests/integration
```

Expected: Existing integration behavior preserved.

**Step 5: Commit**

```bash
git add packages/core/tests/integration packages/core/tests/agent packages/core/tests/tools/integration packages/core/tests/memory/observation
git commit -m "test(core): centralize integration-like suites under tests/integration"
```

---

### Task 3: Move Agent, Session, and Tool Move-Now Suites to Nearest `__tests__`

**Files:**

- Move:
  - `packages/core/tests/agent/workflow/model-provider.test.ts` -> `packages/core/src/agent/workflow/__tests__/model-provider.test.ts`
  - `packages/core/tests/session/manager.test.ts` -> `packages/core/src/session/__tests__/manager.integration.test.ts`
  - `packages/core/tests/session/shutdown.test.ts` -> `packages/core/src/session/__tests__/shutdown.integration.test.ts`
  - `packages/core/tests/tools/task.test.ts` -> `packages/core/src/tools/__tests__/task.integration.test.ts`
  - `packages/core/tests/tools/task-parallel.test.ts` -> `packages/core/src/tools/__tests__/task-parallel.integration.test.ts`
  - `packages/core/tests/tools/filesystem/apply-patch.test.ts` -> `packages/core/src/tools/filesystem/__tests__/apply-patch.integration.test.ts`
  - `packages/core/tests/tools/search-docs/discovery-tools.test.ts` -> `packages/core/src/tools/search-docs/__tests__/discovery-tools.integration.test.ts`
  - `packages/core/tests/tools/search-docs/git-manager.test.ts` -> `packages/core/src/tools/search-docs/__tests__/git-manager.integration.test.ts`
  - `packages/core/tests/tools/search-docs/search-docs.test.ts` -> `packages/core/src/tools/search-docs/__tests__/search-docs.integration.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run src/tools/__tests__/task.integration.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before move.

**Step 3: Write minimal implementation**

Move with `git mv`; ensure imports use `@/` (no `../src` paths).

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run \
  src/agent/workflow/__tests__/model-provider.test.ts \
  src/session/__tests__/manager.integration.test.ts \
  src/tools/__tests__/task.integration.test.ts \
  src/tools/search-docs/__tests__/search-docs.integration.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/src/agent/workflow packages/core/src/session packages/core/src/tools packages/core/tests/agent packages/core/tests/session packages/core/tests/tools
git commit -m "test(core): colocate agent/session/tools move-now suites"
```

---

### Task 4: Move Memory Observation Move-Now Suites

**Files:**

- Move:
  - `packages/core/tests/memory/observation/explore-prompts.test.ts` -> `packages/core/src/memory/observation/__tests__/explore-prompts.test.ts`
  - `packages/core/tests/memory/observation/mode-config.test.ts` -> `packages/core/src/memory/observation/__tests__/mode-config.test.ts`
  - `packages/core/tests/memory/observation/mode-prompts.test.ts` -> `packages/core/src/memory/observation/__tests__/mode-prompts.test.ts`
  - `packages/core/tests/memory/observation/observer-modes.test.ts` -> `packages/core/src/memory/observation/__tests__/observer-modes.test.ts`
  - `packages/core/tests/memory/observation/observer-runtime.test.ts` -> `packages/core/src/memory/observation/__tests__/observer-runtime.test.ts`
  - `packages/core/tests/memory/observation/observer.test.ts` -> `packages/core/src/memory/observation/__tests__/observer.test.ts`
  - `packages/core/tests/memory/observation/phase5-prompt-quality.test.ts` -> `packages/core/src/memory/observation/__tests__/phase5-prompt-quality.test.ts`
  - `packages/core/tests/memory/observation/sealing.test.ts` -> `packages/core/src/memory/observation/__tests__/sealing.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run src/memory/observation/__tests__/observer.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before move.

**Step 3: Write minimal implementation**

Move with `git mv`; convert any `../../../src/...` imports to `@/...`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run src/memory/observation/__tests__
```

Expected: PASS for moved files.

**Step 5: Commit**

```bash
git add packages/core/src/memory/observation packages/core/tests/memory/observation
git commit -m "test(core): colocate memory observation move-now suites"
```

---

### Task 5: Decouple-First - Add Core Test DB Bridge Surface

**Files:**

- Create: `packages/core/src/testing/db.ts`
- Create: `packages/core/src/testing/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json`

**Step 1: Write the failing test**

Add a minimal compile-time test import in one decouple-first suite:

```ts
import { getDb } from "@/testing/db";
```

Run:

```bash
pnpm --filter @sakti-code/core run test:typecheck
```

Expected: FAIL (module not found before bridge is added).

**Step 2: Run test to verify it fails**

Capture TS module resolution error for `@/testing/db`.

**Step 3: Write minimal implementation**

- Add `src/testing/db.ts` as a thin, core-owned adapter that re-exports required DB test helpers.
- Add `src/testing/index.ts` if needed for grouped exports.
- Add export entry in `src/index.ts` (test-only safe export surface).
- Update `package.json` exports map to include `"./testing/db": "./src/testing/db.ts"` (preserve existing public contract).

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core run test:typecheck
```

Expected: PASS for bridge import resolution.

**Step 5: Commit**

```bash
git add packages/core/src/testing packages/core/src/index.ts packages/core/package.json
git commit -m "test(core): add core-owned testing db bridge surface"
```

---

### Task 6: Decouple-First - Migrate DB-Coupled Memory/Session/Spec Tests to Bridge Imports

**Files:**

- Modify (import rewrites first, no moves yet):
  - `packages/core/tests/memory/**/*.test.ts`
  - `packages/core/tests/session/mode-transition.test.ts`
  - `packages/core/tests/spec/*.test.ts`

**Step 1: Write the failing test**

Run targeted typecheck:

```bash
pnpm --filter @sakti-code/core run test:typecheck
```

Expected: FAIL while mixed old/new import patterns exist.

**Step 2: Run test to verify it fails**

Capture first TS errors caused by stale DB/test bridge imports.

**Step 3: Write minimal implementation**

- Replace imports:
  - From `@sakti-code/core/testing/db` -> `@/testing/db` (or chosen internal alias).
  - From `@sakti-code/shared/core-server-bridge` in tests -> core-local test bridge helper where possible.
- Do not move files in this task; only decouple imports.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core run test:typecheck
pnpm --filter @sakti-code/core exec vitest run tests/memory tests/session tests/spec
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/tests/memory packages/core/tests/session packages/core/tests/spec
git commit -m "test(core): decouple db-coupled suites from external test bridge imports"
```

---

### Task 7: Colocate Decoupled Memory/Session/Spec Suites

**Files:**

- Move:
  - `packages/core/tests/memory/message-adapter.test.ts` -> `packages/core/src/memory/__tests__/message-adapter.integration.test.ts`
  - `packages/core/tests/memory/processors.test.ts` -> `packages/core/src/memory/__tests__/processors.integration.test.ts`
  - `packages/core/tests/memory/reflection/schema.test.ts` -> `packages/core/src/memory/reflection/__tests__/schema.integration.test.ts`
  - `packages/core/tests/memory/reflection/storage.test.ts` -> `packages/core/src/memory/reflection/__tests__/storage.integration.test.ts`
  - `packages/core/tests/memory/task/auto-linking.test.ts` -> `packages/core/src/memory/task/__tests__/auto-linking.integration.test.ts`
  - `packages/core/tests/memory/task/storage-events.test.ts` -> `packages/core/src/memory/task/__tests__/storage-events.integration.test.ts`
  - `packages/core/tests/memory/task/storage.test.ts` -> `packages/core/src/memory/task/__tests__/storage.integration.test.ts`
  - `packages/core/tests/memory/task/task-mutate.test.ts` -> `packages/core/src/memory/task/__tests__/task-mutate.integration.test.ts`
  - `packages/core/tests/memory/working-memory/storage.test.ts` -> `packages/core/src/memory/working-memory/__tests__/storage.integration.test.ts`
  - `packages/core/tests/memory/observation/agent-loop.test.ts` -> `packages/core/src/memory/observation/__tests__/agent-loop.integration.test.ts`
  - `packages/core/tests/memory/observation/orchestration.test.ts` -> `packages/core/src/memory/observation/__tests__/orchestration.integration.test.ts`
  - `packages/core/tests/memory/observation/storage.test.ts` -> `packages/core/src/memory/observation/__tests__/storage.integration.test.ts`
  - `packages/core/tests/session/mode-transition.test.ts` -> `packages/core/src/session/__tests__/mode-transition.integration.test.ts`
  - `packages/core/tests/spec/compiler.test.ts` -> `packages/core/src/spec/__tests__/compiler.integration.test.ts`
  - `packages/core/tests/spec/helpers.test.ts` -> `packages/core/src/spec/__tests__/helpers.integration.test.ts`
  - `packages/core/tests/spec/injector.test.ts` -> `packages/core/src/spec/__tests__/injector.integration.test.ts`
  - `packages/core/tests/spec/plan.test.ts` -> `packages/core/src/spec/__tests__/plan.integration.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run src/spec/__tests__/compiler.integration.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL before moves.

**Step 3: Write minimal implementation**

Move using `git mv` to exact locations above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core exec vitest run \
  src/memory \
  src/session/__tests__/mode-transition.integration.test.ts \
  src/spec/__tests__
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/src/memory packages/core/src/session packages/core/src/spec packages/core/tests/memory packages/core/tests/session packages/core/tests/spec
git commit -m "test(core): colocate decoupled memory session and spec suites"
```

---

### Task 8: Remove Legacy Domain Test Discovery and Enforce Layout Guardrail

**Files:**

- Create: `packages/core/scripts/check-no-legacy-domain-tests.sh`
- Modify: `packages/core/package.json`
- Modify: `packages/core/vitest.config.ts`
- Modify: `packages/core/tests/TESTING_ARCHITECTURE.md`

**Step 1: Write the failing test**

Create guardrail script:

```bash
#!/usr/bin/env bash
set -euo pipefail
if rg --files packages/core/tests/{agent,memory,session,spec,tools} -g "*.test.ts" | grep -q .; then
  echo "Found forbidden legacy domain test files under packages/core/tests/*"
  exit 1
fi
```

**Step 2: Run test to verify it fails**

Run:

```bash
bash packages/core/scripts/check-no-legacy-domain-tests.sh
```

Expected: FAIL until legacy files are removed/moved.

**Step 3: Write minimal implementation**

- Update `vitest.config.ts` include to:
  - `src/**/__tests__/**/*.test.ts`
  - `tests/integration/**/*.test.ts`
  - `tests/e2e/**/*.test.ts` (if present)
- Add package script:
  - `"test:layout": "bash ./scripts/check-no-legacy-domain-tests.sh"`
- Update `tests/TESTING_ARCHITECTURE.md` to reflect final nearest-`__tests__` policy and retained centralized dirs.
- Remove now-empty legacy test directories under `tests/{agent,memory,session,spec,tools}`.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/core run test:layout
pnpm --filter @sakti-code/core run test:unit
pnpm --filter @sakti-code/core run test:integration
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/core/scripts/check-no-legacy-domain-tests.sh packages/core/package.json packages/core/vitest.config.ts packages/core/tests/TESTING_ARCHITECTURE.md packages/core/tests
git commit -m "test(core): enforce nearest __tests__ layout and retire legacy domain test dirs"
```

---

### Task 9: Final Verification and Merge Readiness

**Files:**

- Modify: none expected (verification-only unless fixes required)

**Step 1: Write the failing test**

Run full gates:

```bash
pnpm --filter @sakti-code/core run test:typecheck
pnpm --filter @sakti-code/core run lint
pnpm --filter @sakti-code/core run test:unit
pnpm --filter @sakti-code/core run test:integration
pnpm --filter @sakti-code/core run test:layout
pnpm --filter @sakti-code/core run test
```

**Step 2: Run test to verify it fails**

Expected: Any failure should be addressed in minimal follow-up fix commits.

**Step 3: Write minimal implementation**

Apply only targeted fixes required for green gates.

**Step 4: Run test to verify it passes**

Re-run exact commands above; expected PASS.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore(core-tests): finalize nearest __tests__ colocation migration"
```

---

## End-State Acceptance Criteria

1. Unit/domain suites are colocated under nearest `packages/core/src/**/__tests__/`.
2. Only system-level suites remain in centralized:
   - `packages/core/tests/integration/**`
   - `packages/core/tests/e2e/**` (if any).
3. `packages/core/tests/helpers/**` and `packages/core/tests/fixtures/**` remain centralized.
4. No test files remain under `packages/core/tests/{agent,memory,session,spec,tools}`.
5. `pnpm --filter @sakti-code/core run test:typecheck` passes.
6. `pnpm --filter @sakti-code/core run lint` passes.
7. `pnpm --filter @sakti-code/core run test:unit` passes.
8. `pnpm --filter @sakti-code/core run test:integration` passes.
9. `pnpm --filter @sakti-code/core run test:layout` passes.

## Notes for Execution

- Keep `@/` alias as the only internal import style in this migration.
- Do not mix this migration with `#*` subpath introduction.
- Prefer `git mv` for all moves to preserve history.
- Run `@verification-before-completion` before closing each task.
