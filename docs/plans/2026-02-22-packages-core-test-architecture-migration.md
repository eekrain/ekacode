# Packages/Core Test Architecture Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate recurring TypeScript module-resolution and path-drift failures in `packages/core` tests by introducing deterministic TS ownership, batched test colocation, and regression guardrails.

**Architecture:** Hybrid model: colocated unit tests under `src/**/__tests__` and centralized integration tests under `tests/integration/**`. Use `@/*` import identity instead of deep relative paths. Enforce with lint + CI.

**Tech Stack:** TypeScript 5.9, Vitest 4, pnpm workspace, ESLint flat config, Node ESM.

---

## Success Criteria

1. `pnpm --filter @sakti-code/core typecheck` passes.
2. `pnpm --filter @sakti-code/core test:typecheck` passes.
3. `pnpm --filter @sakti-code/core test:unit` passes.
4. `pnpm --filter @sakti-code/core test:integration` passes.
5. `pnpm --filter @sakti-code/core lint` passes.
6. No deep relative source imports remain in core tests.
7. Unit tests for migrated domains are colocated under `src/**/__tests__`.
8. CI enforces the same matrix.

---

## Scope

### In Scope

- `packages/core` test structure migration.
- Core-specific tsconfig and vitest configuration updates.
- Import normalization and lint enforcement.
- Integration test hardening.
- Documentation and CI policy lock.

### Out of Scope

- Full migration for other workspace packages/apps.
- Runtime feature refactors unrelated to tests.
- Full Node `#*` subpath import migration in this phase.

---

## Migration Principles

1. Red -> green -> commit for every task.
2. No batch advances with red checks.
3. Move first, then verify, then delete duplicates.
4. Keep integration tests centralized unless clearly better to colocate.
5. Preserve clean commit history and reversible slices.
6. Prefer scripted rewrites for repetitive changes.
7. Treat CLI and editor diagnostics as equal quality gates.

---

## Batch Roadmap

- **Batch 0:** Foundation and guardrails.
- **Batch 1:** Wave A (`spec`, `config`, `chat`).
- **Batch 2:** Wave B (`agent`, `session`, `workspace`).
- **Batch 3:** Wave C (`tools`, `instance`, `skill`).
- **Batch 4:** Wave D (`lsp`, `plugin`, `security`).
- **Batch 5:** Wave E (`memory`, `prompts`).
- **Batch 6:** Integration hardening.
- **Batch 7:** Cleanup, docs, CI enforcement.
- **Batch 8:** Final verification and merge gate.

---

## Baseline Context

- `packages/core/tsconfig.json` currently includes only `src/**/*`.
- `packages/core/tests/**/*` can drift into inferred-project behavior.
- Some tests still use deep relative imports into `src`.
- Vitest setup uses `tests/vitest.setup.ts`.
- Existing lint already blocks key cross-package imports with limited exceptions.

---

## Batch 0: Foundation and Guardrails

### Task 0.1: Capture baseline and create migration log

**Files:**

- Create: `packages/core/tests/.migration/baseline.md`
- Test: baseline command matrix

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("baseline", () => {
  it("records pre-migration status", () => {
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
`pnpm --filter @sakti-code/core test:typecheck`

Expected: script missing before Task 0.3.

**Step 3: Write minimal implementation**

Create baseline file with:

- command
- timestamp
- exit code
- summary

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core typecheck`
- `pnpm --filter @sakti-code/core lint`
- `pnpm --filter @sakti-code/core test`

Expected: baseline evidence is recorded.

**Step 5: Commit**

```bash
git add packages/core/tests/.migration/baseline.md
git commit -m "chore(core-tests): capture migration baseline"
```

---

### Task 0.2: Add explicit test tsconfig (`tsconfig.spec.json`)

**Files:**

- Create: `packages/core/tsconfig.spec.json`
- Modify: `packages/core/tsconfig.json`
- Test: `tsc -p packages/core/tsconfig.spec.json --noEmit`

**Step 1: Write the failing test**

Run:
`pnpm exec tsc -p packages/core/tsconfig.spec.json --noEmit`

Expected: FAIL before file exists.

**Step 2: Run test to verify it fails**

Confirm missing config error.

**Step 3: Write minimal implementation**

Spec config requirements:

- `noEmit: true`
- `rootDir: .`
- `types: ["vitest/globals", "node"]`
- include `src/**/*.ts` and `tests/**/*.ts`

**Step 4: Run test to verify it passes**

Run:
`pnpm exec tsc -p packages/core/tsconfig.spec.json --noEmit`

Expected: deterministic CLI ownership for tests.

**Step 5: Commit**

```bash
git add packages/core/tsconfig.json packages/core/tsconfig.spec.json
git commit -m "build(core-tests): add explicit test tsconfig"
```

---

### Task 0.3: Add deterministic scripts for unit, integration, and test typecheck

**Files:**

- Modify: `packages/core/package.json`
- Test: scripts execute with intended scope

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core test:typecheck`

Expected: FAIL before script definition.

**Step 2: Run test to verify it fails**

Confirm script not found.

**Step 3: Write minimal implementation**

Scripts to add:

- `test:typecheck`
- `test:unit`
- `test:integration`
- `test:all`

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core test:integration`

Expected: scripts run and scopes are predictable.

**Step 5: Commit**

```bash
git add packages/core/package.json
git commit -m "chore(core-tests): add deterministic test scripts"
```

---

### Task 0.4: Align Vitest discovery with hybrid layout

**Files:**

- Modify: `packages/core/vitest.config.ts`
- Test: discovery from `src` and `tests/integration`

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run src --passWithNoTests`

Expected: incomplete discovery before config update.

**Step 2: Run test to verify it fails**

Capture missing suite patterns.

**Step 3: Write minimal implementation**

Use include patterns:

- `src/**/*.test.ts`
- `tests/integration/**/*.test.ts`

Keep setup file path.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core test:integration`

Expected: both classes of tests are discovered.

**Step 5: Commit**

```bash
git add packages/core/vitest.config.ts
git commit -m "test(core): align vitest discovery with hybrid model"
```

---

### Task 0.5: Enforce lint guard against deep relative source imports in tests

**Files:**

- Modify: `eslint.config.js`
- Test: lint catches banned import patterns

**Step 1: Write the failing test**

Add temporary bad import:

```ts
import { parseSpec } from "../../../src/spec/parser";
```

**Step 2: Run test to verify it fails**

Run:
`pnpm --filter @sakti-code/core lint`

Expected: restricted import violation.

**Step 3: Write minimal implementation**

Block in core tests:

- `../src/*`
- `../../src/*`
- `../../../src/*`
- `../../../../src/*`

Keep explicit exceptions minimal.

**Step 4: Run test to verify it passes**

Run:
`pnpm --filter @sakti-code/core lint`

Expected: pass after removing temporary bad import.

**Step 5: Commit**

```bash
git add eslint.config.js
git commit -m "lint(core-tests): block deep relative src imports"
```

---

### Task 0.6: Add migration helper scripts (move + rewrite)

**Files:**

- Create: `packages/core/tests/.migration/move-domain-tests.mjs`
- Create: `packages/core/tests/.migration/rewrite-imports.mjs`
- Test: dry-run mode for one domain

**Step 1: Write the failing test**

Run:
`node packages/core/tests/.migration/move-domain-tests.mjs --dry-run --domain spec`

Expected: missing script error.

**Step 2: Run test to verify it fails**

Confirm script absence.

**Step 3: Write minimal implementation**

Script capabilities:

- list files by domain
- compute colocated destinations
- dry-run and apply modes
- import rewrite to `@/*`

**Step 4: Run test to verify it passes**

Run:

- `node packages/core/tests/.migration/move-domain-tests.mjs --dry-run --domain spec`
- `node packages/core/tests/.migration/rewrite-imports.mjs --dry-run --domain spec`

Expected: deterministic output.

**Step 5: Commit**

```bash
git add packages/core/tests/.migration/move-domain-tests.mjs packages/core/tests/.migration/rewrite-imports.mjs
git commit -m "chore(core-tests): add migration helper scripts"
```

---

## Batch 1: Wave A

**Domains in scope:** `spec, config, chat`

**Batch gate:**

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

### Task 1.1: Migrate all wave domains to colocated tests and rewrite imports

**Files:**

- Move: `packages/core/tests/<domain>/**/*.test.ts` for domains in this wave
- Create: `packages/core/src/<domain>/__tests__/`
- Modify: moved test imports

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: old wave-domain tests are still discovered in legacy locations.

**Step 2: Run test to verify it fails**

Run for each domain in wave:

- `node packages/core/tests/.migration/move-domain-tests.mjs --dry-run --domain <domain>`
- `node packages/core/tests/.migration/rewrite-imports.mjs --dry-run --domain <domain>`

Expected: dry-run output lists concrete moves and rewrites.

**Step 3: Write minimal implementation**

For each domain in wave:

```bash
node packages/core/tests/.migration/move-domain-tests.mjs --apply --domain <domain>
node packages/core/tests/.migration/rewrite-imports.mjs --apply --domain <domain>
```

Import policy target:

- `@/<domain>/...` only.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`

Expected: wave domains execute from colocated paths with green typecheck.

**Step 5: Commit**

```bash
git add packages/core/src packages/core/tests
git commit -m "refactor(core-tests): migrate wave 1 domains to colocated tests"
```

---

### Task 1.2: Remove legacy duplicates and verify parity for wave domains

**Files:**

- Delete/Modify: `packages/core/tests/<domain>/**` for migrated domains
- Modify: `packages/core/tests/.migration/baseline.md`
- Test: wave batch gate

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: legacy duplicates are still discoverable before cleanup.

**Step 2: Run test to verify it fails**

Delete only wave-domain duplicates already verified in Task 1.1.

Expected: old-tree discovery for wave domains is gone.

**Step 3: Write minimal implementation**

- Remove duplicate legacy test files.
- Keep centralized integration assets intact.
- Update migration note:
  - moved file count
  - deleted file count
  - residual exceptions

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

Expected: batch gate remains green after deletion.

**Step 5: Commit**

```bash
git add packages/core/tests packages/core/tests/.migration/baseline.md
git commit -m "chore(core-tests): remove legacy duplicates for wave 1"
```

---

## Batch 2: Wave B

**Domains in scope:** `agent, session, workspace`

**Batch gate:**

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

### Task 2.1: Migrate all wave domains to colocated tests and rewrite imports

**Files:**

- Move: `packages/core/tests/<domain>/**/*.test.ts` for domains in this wave
- Create: `packages/core/src/<domain>/__tests__/`
- Modify: moved test imports

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: old wave-domain tests are still discovered in legacy locations.

**Step 2: Run test to verify it fails**

Run for each domain in wave:

- `node packages/core/tests/.migration/move-domain-tests.mjs --dry-run --domain <domain>`
- `node packages/core/tests/.migration/rewrite-imports.mjs --dry-run --domain <domain>`

Expected: dry-run output lists concrete moves and rewrites.

**Step 3: Write minimal implementation**

For each domain in wave:

```bash
node packages/core/tests/.migration/move-domain-tests.mjs --apply --domain <domain>
node packages/core/tests/.migration/rewrite-imports.mjs --apply --domain <domain>
```

Import policy target:

- `@/<domain>/...` only.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`

Expected: wave domains execute from colocated paths with green typecheck.

**Step 5: Commit**

```bash
git add packages/core/src packages/core/tests
git commit -m "refactor(core-tests): migrate wave 2 domains to colocated tests"
```

---

### Task 2.2: Remove legacy duplicates and verify parity for wave domains

**Files:**

- Delete/Modify: `packages/core/tests/<domain>/**` for migrated domains
- Modify: `packages/core/tests/.migration/baseline.md`
- Test: wave batch gate

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: legacy duplicates are still discoverable before cleanup.

**Step 2: Run test to verify it fails**

Delete only wave-domain duplicates already verified in Task 2.1.

Expected: old-tree discovery for wave domains is gone.

**Step 3: Write minimal implementation**

- Remove duplicate legacy test files.
- Keep centralized integration assets intact.
- Update migration note:
  - moved file count
  - deleted file count
  - residual exceptions

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

Expected: batch gate remains green after deletion.

**Step 5: Commit**

```bash
git add packages/core/tests packages/core/tests/.migration/baseline.md
git commit -m "chore(core-tests): remove legacy duplicates for wave 2"
```

---

## Batch 3: Wave C

**Domains in scope:** `tools, instance, skill`

**Batch gate:**

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

### Task 3.1: Migrate all wave domains to colocated tests and rewrite imports

**Files:**

- Move: `packages/core/tests/<domain>/**/*.test.ts` for domains in this wave
- Create: `packages/core/src/<domain>/__tests__/`
- Modify: moved test imports

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: old wave-domain tests are still discovered in legacy locations.

**Step 2: Run test to verify it fails**

Run for each domain in wave:

- `node packages/core/tests/.migration/move-domain-tests.mjs --dry-run --domain <domain>`
- `node packages/core/tests/.migration/rewrite-imports.mjs --dry-run --domain <domain>`

Expected: dry-run output lists concrete moves and rewrites.

**Step 3: Write minimal implementation**

For each domain in wave:

```bash
node packages/core/tests/.migration/move-domain-tests.mjs --apply --domain <domain>
node packages/core/tests/.migration/rewrite-imports.mjs --apply --domain <domain>
```

Import policy target:

- `@/<domain>/...` only.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`

Expected: wave domains execute from colocated paths with green typecheck.

**Step 5: Commit**

```bash
git add packages/core/src packages/core/tests
git commit -m "refactor(core-tests): migrate wave 3 domains to colocated tests"
```

---

### Task 3.2: Remove legacy duplicates and verify parity for wave domains

**Files:**

- Delete/Modify: `packages/core/tests/<domain>/**` for migrated domains
- Modify: `packages/core/tests/.migration/baseline.md`
- Test: wave batch gate

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: legacy duplicates are still discoverable before cleanup.

**Step 2: Run test to verify it fails**

Delete only wave-domain duplicates already verified in Task 3.1.

Expected: old-tree discovery for wave domains is gone.

**Step 3: Write minimal implementation**

- Remove duplicate legacy test files.
- Keep centralized integration assets intact.
- Update migration note:
  - moved file count
  - deleted file count
  - residual exceptions

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

Expected: batch gate remains green after deletion.

**Step 5: Commit**

```bash
git add packages/core/tests packages/core/tests/.migration/baseline.md
git commit -m "chore(core-tests): remove legacy duplicates for wave 3"
```

---

## Batch 4: Wave D

**Domains in scope:** `lsp, plugin, security`

**Batch gate:**

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

### Task 4.1: Migrate all wave domains to colocated tests and rewrite imports

**Files:**

- Move: `packages/core/tests/<domain>/**/*.test.ts` for domains in this wave
- Create: `packages/core/src/<domain>/__tests__/`
- Modify: moved test imports

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: old wave-domain tests are still discovered in legacy locations.

**Step 2: Run test to verify it fails**

Run for each domain in wave:

- `node packages/core/tests/.migration/move-domain-tests.mjs --dry-run --domain <domain>`
- `node packages/core/tests/.migration/rewrite-imports.mjs --dry-run --domain <domain>`

Expected: dry-run output lists concrete moves and rewrites.

**Step 3: Write minimal implementation**

For each domain in wave:

```bash
node packages/core/tests/.migration/move-domain-tests.mjs --apply --domain <domain>
node packages/core/tests/.migration/rewrite-imports.mjs --apply --domain <domain>
```

Import policy target:

- `@/<domain>/...` only.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`

Expected: wave domains execute from colocated paths with green typecheck.

**Step 5: Commit**

```bash
git add packages/core/src packages/core/tests
git commit -m "refactor(core-tests): migrate wave 4 domains to colocated tests"
```

---

### Task 4.2: Remove legacy duplicates and verify parity for wave domains

**Files:**

- Delete/Modify: `packages/core/tests/<domain>/**` for migrated domains
- Modify: `packages/core/tests/.migration/baseline.md`
- Test: wave batch gate

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: legacy duplicates are still discoverable before cleanup.

**Step 2: Run test to verify it fails**

Delete only wave-domain duplicates already verified in Task 4.1.

Expected: old-tree discovery for wave domains is gone.

**Step 3: Write minimal implementation**

- Remove duplicate legacy test files.
- Keep centralized integration assets intact.
- Update migration note:
  - moved file count
  - deleted file count
  - residual exceptions

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

Expected: batch gate remains green after deletion.

**Step 5: Commit**

```bash
git add packages/core/tests packages/core/tests/.migration/baseline.md
git commit -m "chore(core-tests): remove legacy duplicates for wave 4"
```

---

## Batch 5: Wave E

**Domains in scope:** `memory, prompts`

**Batch gate:**

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

### Task 5.1: Migrate all wave domains to colocated tests and rewrite imports

**Files:**

- Move: `packages/core/tests/<domain>/**/*.test.ts` for domains in this wave
- Create: `packages/core/src/<domain>/__tests__/`
- Modify: moved test imports

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: old wave-domain tests are still discovered in legacy locations.

**Step 2: Run test to verify it fails**

Run for each domain in wave:

- `node packages/core/tests/.migration/move-domain-tests.mjs --dry-run --domain <domain>`
- `node packages/core/tests/.migration/rewrite-imports.mjs --dry-run --domain <domain>`

Expected: dry-run output lists concrete moves and rewrites.

**Step 3: Write minimal implementation**

For each domain in wave:

```bash
node packages/core/tests/.migration/move-domain-tests.mjs --apply --domain <domain>
node packages/core/tests/.migration/rewrite-imports.mjs --apply --domain <domain>
```

Import policy target:

- `@/<domain>/...` only.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`

Expected: wave domains execute from colocated paths with green typecheck.

**Step 5: Commit**

```bash
git add packages/core/src packages/core/tests
git commit -m "refactor(core-tests): migrate wave 5 domains to colocated tests"
```

---

### Task 5.2: Remove legacy duplicates and verify parity for wave domains

**Files:**

- Delete/Modify: `packages/core/tests/<domain>/**` for migrated domains
- Modify: `packages/core/tests/.migration/baseline.md`
- Test: wave batch gate

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run packages/core/tests --passWithNoTests`

Expected: legacy duplicates are still discoverable before cleanup.

**Step 2: Run test to verify it fails**

Delete only wave-domain duplicates already verified in Task 5.1.

Expected: old-tree discovery for wave domains is gone.

**Step 3: Write minimal implementation**

- Remove duplicate legacy test files.
- Keep centralized integration assets intact.
- Update migration note:
  - moved file count
  - deleted file count
  - residual exceptions

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:unit`
- `pnpm --filter @sakti-code/core lint`

Expected: batch gate remains green after deletion.

**Step 5: Commit**

```bash
git add packages/core/tests packages/core/tests/.migration/baseline.md
git commit -m "chore(core-tests): remove legacy duplicates for wave 5"
```

---

## Batch 6: Integration Hardening

### Task 6.1: Inventory integration suites and owners

**Files:**

- Create: `packages/core/tests/.migration/integration-inventory.md`
- Test: inventory exists and is populated

**Step 1: Write the failing test**

Run:
`test -f packages/core/tests/.migration/integration-inventory.md && echo ok`

Expected: missing file before implementation.

**Step 2: Run test to verify it fails**

Confirm file does not exist.

**Step 3: Write minimal implementation**

Add columns:

- file path
- owner domain
- dependency class
- setup requirements
- status

**Step 4: Run test to verify it passes**

Run:
`rg -n "owner domain|dependency class|setup requirements" packages/core/tests/.migration/integration-inventory.md`

Expected: key columns present.

**Step 5: Commit**

```bash
git add packages/core/tests/.migration/integration-inventory.md
git commit -m "docs(core-tests): inventory integration suite ownership"
```

---

### Task 6.2: Normalize integration imports to stable aliases

**Files:**

- Modify: `packages/core/tests/integration/**/*.test.ts`
- Test: grep + typecheck + integration run

**Step 1: Write the failing test**

Run:
`rg -n "\.\./\.\./src|\.\./\.\./\.\./src" packages/core/tests/integration`

Expected: matches before normalization.

**Step 2: Run test to verify it fails**

Capture all matched files.

**Step 3: Write minimal implementation**

Rewrite to:

- `@/*` for core internals
- package exports where required

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core test:typecheck`
- `pnpm --filter @sakti-code/core test:integration`

Expected: no import-resolution errors.

**Step 5: Commit**

```bash
git add packages/core/tests/integration
git commit -m "refactor(core-tests): normalize integration imports"
```

---

### Task 6.3: Stabilize setup and helper bridge contracts

**Files:**

- Modify: `packages/core/tests/vitest.setup.ts`
- Modify: `packages/core/tests/helpers/core-db.ts`
- Test: setup-sensitive test slices

**Step 1: Write the failing test**

Run:
`pnpm --filter @sakti-code/core exec vitest run tests/spec/compiler.test.ts`

Expected: fails if setup or bridge contracts are unstable.

**Step 2: Run test to verify it fails**

Capture root cause details.

**Step 3: Write minimal implementation**

- tighten helper typing
- constrain server bridge imports
- keep lint exception surface minimal

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/core exec vitest run tests/spec/compiler.test.ts`
- `pnpm --filter @sakti-code/core lint`

Expected: setup-sensitive checks pass.

**Step 5: Commit**

```bash
git add packages/core/tests/vitest.setup.ts packages/core/tests/helpers/core-db.ts eslint.config.js
git commit -m "test(core): stabilize setup and bridge helper contracts"
```

---

## Batch 7: Cleanup, Docs, and CI Enforcement

### Task 7.1: Remove stale legacy test directories

**Files:**

- Delete/Modify: stale folders under `packages/core/tests`
- Test: test-tree audit

**Step 1: Write the failing test**

Run:
`find packages/core/tests -maxdepth 2 -type d | sort`

Expected: stale domain folders are still present before cleanup.

**Step 2: Run test to verify it fails**

Capture stale folder list.

**Step 3: Write minimal implementation**

Delete stale unit-domain folders only.
Keep:

- `tests/integration`
- `tests/helpers`
- `tests/vitest.setup.ts`
- `.migration` docs

**Step 4: Run test to verify it passes**

Run:
`find packages/core/tests -maxdepth 2 -type d | sort`

Expected: only approved directories remain.

**Step 5: Commit**

```bash
git add -A packages/core/tests
git commit -m "chore(core-tests): remove stale legacy test directories"
```

---

### Task 7.2: Publish testing architecture document

**Files:**

- Create: `packages/core/tests/TESTING_ARCHITECTURE.md`
- Modify: `packages/core/README.md`
- Test: documentation completeness

**Step 1: Write the failing test**

Run:
`test -f packages/core/tests/TESTING_ARCHITECTURE.md && echo ok`

Expected: no output before creation.

**Step 2: Run test to verify it fails**

Confirm file missing.

**Step 3: Write minimal implementation**

Document:

- unit vs integration placement
- allowed and forbidden import patterns
- required verification commands

**Step 4: Run test to verify it passes**

Run:
`rg -n "__tests__|tests/integration|@/\*|forbidden|test:typecheck" packages/core/tests/TESTING_ARCHITECTURE.md`

Expected: required topics present.

**Step 5: Commit**

```bash
git add packages/core/tests/TESTING_ARCHITECTURE.md packages/core/README.md
git commit -m "docs(core-tests): publish testing architecture standard"
```

---

### Task 7.3: Enforce core test matrix in CI

**Files:**

- Modify: CI workflows touching core checks
- Test: local matrix parity

**Step 1: Write the failing test**

Run local matrix:

```bash
pnpm --filter @sakti-code/core test:typecheck
pnpm --filter @sakti-code/core lint
pnpm --filter @sakti-code/core test
```

Expected: CI currently may not enforce exact chain.

**Step 2: Run test to verify it fails**

Confirm CI gap.

**Step 3: Write minimal implementation**

Add CI chain in this order:

1. `test:typecheck`
2. `lint`
3. `test`

**Step 4: Run test to verify it passes**

Run local chain again.

Expected: all commands green and mirrored in CI.

**Step 5: Commit**

```bash
git add .github/workflows
git commit -m "ci(core-tests): enforce core test matrix"
```

---

### Task 7.4: Add import-regression script and package command

**Files:**

- Create: `packages/core/tests/.migration/check-import-regressions.sh`
- Modify: `packages/core/package.json`
- Test: script + command alias

**Step 1: Write the failing test**

Run:
`bash packages/core/tests/.migration/check-import-regressions.sh`

Expected: missing script error.

**Step 2: Run test to verify it fails**

Confirm missing script.

**Step 3: Write minimal implementation**

Script checks:

- no deep relative source imports
- no banned cross-package imports
- no reintroduced stale test directories

Add command:

- `test:imports`

**Step 4: Run test to verify it passes**

Run:

- `bash packages/core/tests/.migration/check-import-regressions.sh`
- `pnpm --filter @sakti-code/core run test:imports`

Expected: both pass.

**Step 5: Commit**

```bash
git add packages/core/tests/.migration/check-import-regressions.sh packages/core/package.json
git commit -m "chore(core-tests): add import regression enforcement"
```

---

## Batch 8: Final Verification and Merge Gate

### Task 8.1: Run final verification matrix

**Files:**

- Verify: all modified files in `packages/core` and CI workflows
- Test: full command matrix

**Step 1: Write the failing test**

No new code. The matrix is the release gate.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @sakti-code/core typecheck
pnpm --filter @sakti-code/core test:typecheck
pnpm --filter @sakti-code/core lint
pnpm --filter @sakti-code/core test:unit
pnpm --filter @sakti-code/core test:integration
pnpm --filter @sakti-code/core test
pnpm --filter @sakti-code/core run test:imports
```

Expected: all commands pass; any failure blocks merge.

**Step 3: Write minimal implementation**

Fix only residual failures detected by matrix.

**Step 4: Run test to verify it passes**

Re-run exact matrix and confirm green.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(core-tests): complete migration and pass final matrix"
```

---

### Task 8.2: Publish final migration evidence

**Files:**

- Create: `packages/core/tests/.migration/final-verification.md`
- Test: evidence completeness checks

**Step 1: Write the failing test**

Run:
`test -f packages/core/tests/.migration/final-verification.md && echo ok`

Expected: no output before report exists.

**Step 2: Run test to verify it fails**

Confirm report missing.

**Step 3: Write minimal implementation**

Record:

- command outcomes
- migrated domain counts
- retained integration rationale
- follow-up items (if any)

**Step 4: Run test to verify it passes**

Run:
`rg -n "typecheck|test:typecheck|lint|test:unit|test:integration|follow-up" packages/core/tests/.migration/final-verification.md`

Expected: required evidence sections present.

**Step 5: Commit**

```bash
git add packages/core/tests/.migration/final-verification.md
git commit -m "docs(core-tests): publish final migration evidence"
```

---

## Per-Batch Done Checklist

1. Batch scope complete.
2. Batch gate green.
3. Legacy duplicates removed only after parity checks.
4. Migration notes updated.
5. Commits remain focused and reviewable.

---

## Rollback Strategy

If a batch destabilizes core:

1. Revert only in-flight batch commits.
2. Keep Batch 0 guardrails.
3. Re-run baseline matrix.
4. Retry with smaller scope.

---

## Risk Register

- **Hidden coupling after file moves**
  - Mitigation: wave-level migration with immediate green checks.
- **Editor and CLI diagnostics diverge**
  - Mitigation: explicit test tsconfig + `test:typecheck` in CI.
- **Import regressions return later**
  - Mitigation: lint restriction + import regression script.
- **Duplicate execution from stale tests**
  - Mitigation: move -> verify -> delete sequence.

---

## Definition of Done

1. Migrated domain unit tests are colocated under `src/**/__tests__`.
2. Integration suites remain under `tests/integration/**`.
3. `packages/core/tests` contains only approved centralized assets.
4. Verification matrix is green locally and in CI.
5. No deep relative source imports remain in core tests.
6. Standards and guardrails are documented.

---

## Appendix A: Domain-to-Wave Mapping

| Wave    | Domains                         |
| ------- | ------------------------------- |
| Batch 1 | `spec`, `config`, `chat`        |
| Batch 2 | `agent`, `session`, `workspace` |
| Batch 3 | `tools`, `instance`, `skill`    |
| Batch 4 | `lsp`, `plugin`, `security`     |
| Batch 5 | `memory`, `prompts`             |

---

## Appendix B: Final Command Matrix

1. `pnpm --filter @sakti-code/core typecheck`
2. `pnpm --filter @sakti-code/core test:typecheck`
3. `pnpm --filter @sakti-code/core lint`
4. `pnpm --filter @sakti-code/core test:unit`
5. `pnpm --filter @sakti-code/core test:integration`
6. `pnpm --filter @sakti-code/core test`
7. `pnpm --filter @sakti-code/core run test:imports`

---

## Appendix C: Commit Message Catalog

### Foundation

1. `chore(core-tests): capture migration baseline`
2. `build(core-tests): add explicit test tsconfig`
3. `chore(core-tests): add deterministic test scripts`
4. `test(core): align vitest discovery with hybrid model`
5. `lint(core-tests): block deep relative src imports`
6. `chore(core-tests): add migration helper scripts`

### Waves

1. `refactor(core-tests): migrate wave <n> domains to colocated tests`
2. `chore(core-tests): remove legacy duplicates for wave <n>`

### Hardening and Completion

1. `refactor(core-tests): normalize integration imports`
2. `test(core): stabilize setup and bridge helper contracts`
3. `docs(core-tests): publish testing architecture standard`
4. `ci(core-tests): enforce core test matrix`
5. `refactor(core-tests): complete migration and pass final matrix`
6. `docs(core-tests): publish final migration evidence`

---

## Appendix D: Pull Request Checklist

1. Batch boundaries are respected.
2. No unrelated runtime refactors are included.
3. Final matrix output is attached.
4. `final-verification.md` is complete.
5. Remaining follow-ups are explicit.
6. CI is green for all core gates.

---
