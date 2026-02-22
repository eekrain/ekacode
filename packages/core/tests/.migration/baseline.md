# Migration Baseline

> Captured: 2026-02-23T01:39:51Z

## Command Matrix

| Command                                    | Exit Code | Summary                       |
| ------------------------------------------ | --------- | ----------------------------- |
| `pnpm --filter @sakti-code/core typecheck` | 0         | PASS                          |
| `pnpm --filter @sakti-code/core lint`      | 0         | PASS                          |
| `pnpm --filter @sakti-code/core test`      | 0         | PASS (1156 tests, 10 skipped) |

## Test Files Discovery

- 98 test files discovered
- 1156 tests passing
- 10 tests skipped

## Pre-Migration State

- `packages/core/tsconfig.json` includes only `src/**/*`
- `packages/core/tests/**/*` uses legacy domain structure
- Some tests use deep relative imports into `src`
- No explicit `tsconfig.spec.json` exists
- No `test:typecheck`, `test:unit`, `test:integration` scripts defined

## Migration Start Point

Baseline captured. Ready to proceed with Batch 0: Foundation and Guardrails.
