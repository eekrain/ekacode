# Rationale for Tests Retained in `tests/` Directory

## Overview

After migrating waves 1-4 to `src/**/__tests__/`, the following test files remain in `tests/` for documented reasons.

---

## DB-Dependent Tests

These tests import `@sakti-code/core/testing/db` which pulls in `packages/server` dependencies. Moving them to `src/**/__tests__/` causes `test:typecheck` to fail due to cross-package import issues.

### `tests/memory/` (25 test files)

**Reason:** All memory tests are DB-dependent and require database fixtures.

- `tests/memory/message-adapter.test.ts`
- `tests/memory/observation/*.test.ts` (13 files)
- `tests/memory/processors.test.ts`
- `tests/memory/reflection/*.test.ts` (2 files)
- `tests/memory/task/*.test.ts` (4 files)
- `tests/memory/working-memory/storage.test.ts`

### `tests/spec/` (4 test files)

**Reason:** These tests are DB-dependent or require full compilation pipeline.

- `tests/spec/compiler.test.ts` - Full spec compilation, DB fixtures
- `tests/spec/helpers.test.ts` - Helper tests with DB dependencies
- `tests/spec/injector.test.ts` - Injection tests with DB requirements
- `tests/spec/plan.test.ts` - Plan generation with DB fixtures

### `tests/session/` (3 test files)

**Reason:** Pre-existing TypeScript errors and DB dependencies.

- `tests/session/manager.test.ts` - Has type errors, DB-dependent
- `tests/session/shutdown.test.ts` - Has type errors, DB-dependent
- `tests/session/mode-transition.test.ts` - Pure unit, kept for session domain consistency

### `tests/agent/workflow/model-provider.test.ts`

**Reason:** Model provider tests require DB fixtures and external service mocking.

### `tests/agent/build-memory-tools.integration.test.ts`

**Reason:** Integration test for memory tool building, DB-dependent.

---

## Type Error Tests

These tests have pre-existing TypeScript errors unrelated to migration.

### `tests/tools/filesystem/apply-patch.test.ts`

**Reason:** Has type errors in patch application logic, requires separate fix.

### `tests/tools/task-parallel.test.ts`

**Reason:** Has type errors in parallel task execution logic.

### `tests/tools/task.test.ts`

**Reason:** Has type errors in task scheduling logic.

---

## Tests Kept for Domain Organization

These tests are kept in `tests/` for domain consistency, not due to technical blockers.

### `tests/tools/search-docs/` (3 test files)

**Reason:** Kept for domain consistency in tools.

- `tests/tools/search-docs/discovery-tools.test.ts` - Pure unit, could migrate
- `tests/tools/search-docs/git-manager.test.ts` - Pure unit, could migrate
- `tests/tools/search-docs/search-docs.test.ts` - Pure unit, could migrate

### `tests/tools/instance-context-integration.test.ts`

**Reason:** Integration test, belongs in `tests/integration/` or `tests/tools/integration/`.

---

## Integration Tests

### `tests/integration/` (2 test files)

**Reason:** By definition, integration tests remain centralized.

- `tests/integration/e2e-agent.test.ts`
- `tests/integration/search-docs-integration.test.ts`

---

## Fixtures and Helpers

### `tests/fixtures/`

**Reason:** Shared test fixtures used across multiple domains.

### `tests/helpers/`

**Reason:** Shared test helpers including `core-db.ts` database utilities.

### `tests/vitest.setup.ts`

**Reason:** Global test setup configuration.

---

## Migration Statistics

| Metric                             | Count                    |
| ---------------------------------- | ------------------------ |
| Tests migrated to `src/__tests__/` | 96 test files            |
| Tests retained in `tests/`         | 42 test files            |
| Migration completion               | Waves 1-4 (100%)         |
| Waves incomplete                   | Wave E (memory, prompts) |

---

## Follow-up Work

### Low Priority

1. Fix type errors in tools tests:
   - `tests/tools/filesystem/apply-patch.test.ts`
   - `tests/tools/task-parallel.test.ts`
   - `tests/tools/task.test.ts`

2. Fix type errors in session tests:
   - `tests/session/manager.test.ts`
   - `tests/session/shutdown.test.ts`

3. Consider migrating pure unit tests in tools/search-docs/ after Wave E migration is evaluated.

### Not Planned

- Memory domain tests remain in `tests/memory/` permanently due to DB dependencies.
- Wave E was skipped as `prompts/` directory doesn't exist and `memory/` is already covered.
