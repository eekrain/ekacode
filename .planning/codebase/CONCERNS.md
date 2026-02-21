# Codebase Concerns

**Analysis Date:** 2026-02-22

## Tech Debt

**Monorepo Build Configuration:**

- Issue: TypeScript project references work but incremental builds can be slow
- Files: `tsconfig.json`, root and package-level configs
- Impact: Full typecheck takes time during CI
- Fix approach: Consider tsup for faster builds, or optimize turbo tasks

**Missing Test Coverage Scripts:**

- Issue: No unified test coverage enforcement across all packages
- Files: `packages/*/package.json`
- Impact: Coverage gaps may go unnoticed
- Fix approach: Add coverage thresholds in vitest config

**Environment Configuration:**

- Issue: Multiple env vars required, scattered across packages
- Files: `.env`, `packages/*/package.json`
- Impact: Developer onboarding complexity
- Fix approach: Document required env vars clearly

## Known Bugs

**No known bugs currently reported.**

## Security Considerations

**API Key Management:**

- Risk: API keys stored in `.env` (gitignored but in plaintext)
- Files: `.env`, server code using process.env
- Current mitigation: `.env` is gitignored
- Recommendations: Consider secret management service for production

**Electron Context Isolation:**

- Risk: Desktop app may have IPC exposure
- Files: `apps/electron/`, `apps/preload/`
- Current mitigation: Using standard Electron patterns
- Recommendations: Regular security audits of IPC handlers

## Performance Bottlenecks

**AI Response Streaming:**

- Problem: Large AI responses may impact UI
- Files: `packages/core/src/chat/`, `apps/desktop/src/`
- Cause: Full response loaded before rendering
- Improvement path: Implement chunked rendering

**Database Queries:**

- Problem: No query optimization in place yet
- Files: `packages/server/db/`, `packages/server/src/`
- Cause: New project, minimal optimization
- Improvement path: Add query profiling, connection pooling

## Fragile Areas

**Event Bus:**

- Files: `packages/server/src/bus/`, `packages/shared/src/event-types.ts`
- Why fragile: Complex async event handling, potential race conditions
- Safe modification: Add comprehensive tests, use transaction-like patterns
- Test coverage: Unit tests exist, integration tests needed

**Memory Layer:**

- Files: `packages/core/src/memory/`
- Why fragile: External dependency (Mastra), complex persistence logic
- Safe modification: Test with mock Mastra, add error boundaries
- Test coverage: Basic coverage, more edge cases needed

## Scaling Limits

**LibSQL Local:**

- Current capacity: Single file database
- Limit: Concurrent connections, large datasets
- Scaling path: Migrate to LibSQL remote (Turso) for production

**In-Memory Search:**

- Current capacity: Minisearch for local search
- Limit: Desktop app only, dataset size
- Scaling path: Server-side search with full-text indexing

## Dependencies at Risk

**Zod 4.x:**

- Risk: Using pre-release version (^4.3.6)
- Impact: API changes, potential bugs
- Migration plan: Monitor stable release, test upgrades

**Electron 39.x:**

- Risk: Fast-moving version
- Impact: Breaking changes, security patches
- Migration plan: Keep updated via dependabot

## Missing Critical Features

**Comprehensive E2E Testing:**

- Problem: No E2E test suite
- Blocks: Confidence in full user flows

**CI/CD Pipeline:**

- Problem: Basic GitHub Actions only
- Blocks: Automated releases, deployment

## Test Coverage Gaps

**Server Routes:**

- What's not tested: Full HTTP endpoint coverage
- Files: `packages/server/src/`
- Risk: Edge cases in request handling
- Priority: Medium

**Desktop Components:**

- What's not tested: UI interaction tests
- Files: `apps/desktop/src/`
- Risk: UI regressions
- Priority: Low (manual testing sufficient for now)

**AI Agent Flows:**

- What's not tested: Complex multi-turn conversations
- Files: `packages/core/src/agent/`, `packages/core/src/chat/`
- Risk: Broken conversation flows
- Priority: High

---

_Concerns audit: 2026-02-22_
