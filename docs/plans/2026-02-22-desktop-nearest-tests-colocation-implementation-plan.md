# Desktop Nearest `__tests__` Colocation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move desktop unit/component/hook tests from `apps/desktop/tests/unit/**` to nearest `apps/desktop/src/**/__tests__/` folders so refactors do not break test paths.

**Architecture:** Use a hybrid layout. Keep system-level integration/e2e tests centralized in `apps/desktop/tests/integration/**` and `apps/desktop/tests/e2e/**`, but colocate unit-level tests under nearest source folders. Run migration in small batches with transitional Vitest include rules, then remove `tests/unit/**` entirely and enforce a guardrail script.

**Tech Stack:** pnpm workspace, TypeScript 5.9, Vitest 4 projects, Vite 7, Solid Testing Library, ESLint 9.

---

## Scope

- In scope:
  - Move all files currently under `apps/desktop/tests/unit/**` into nearest `apps/desktop/src/**/__tests__/`.
  - Keep integration/e2e test folders as-is.
  - Update Vitest project include/exclude patterns to first support mixed layout, then colocated-only.
  - Add guardrail to prevent reintroducing `tests/unit/**`.
- Out of scope:
  - Rewriting integration/e2e architecture.
  - `@/` to `#*` import migration.
  - Moving `tests/helpers/**` and `tests/fixtures/**` in this plan.

## Preconditions

1. Work from a dedicated worktree branch.
2. Ensure local dependencies are installed:
   - `pnpm install`
3. Baseline verification before edits:
   - `pnpm --filter @sakti-code/desktop run typecheck:test`
   - `pnpm --filter @sakti-code/desktop run test:run`

Use `@systematic-debugging` if any migration batch unexpectedly fails.

---

### Task 1: Enable Transitional Discovery for Mixed Layout

**Files:**

- Modify: `apps/desktop/vitest.config.ts`
- Modify: `apps/desktop/tsconfig.spec.json`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/**/__tests__/**/*.test.ts --passWithNoTests=false
```

**Step 2: Run test to verify it fails**

Expected: FAIL with “No test files found”.

**Step 3: Write minimal implementation**

- Update Vitest project includes to support both layouts during migration:
  - Keep existing `tests/unit/**` includes.
  - Add `src/**/__tests__/**/*.test.ts` and `src/**/__tests__/**/*.test.tsx`.
- Keep `tests/integration/**` and `tests/e2e/**` untouched.
- Ensure `tsconfig.spec.json` includes `src/**/*` (covers new colocated tests).

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop run typecheck:test
pnpm --filter @sakti-code/desktop run test:unit
pnpm --filter @sakti-code/desktop run test:ui
```

Expected: PASS with mixed layout.

**Step 5: Commit**

```bash
git add apps/desktop/vitest.config.ts apps/desktop/tsconfig.spec.json
git commit -m "test(desktop): enable transitional mixed test discovery"
```

---

### Task 2: Move Component/UI Tests to Nearest `__tests__`

**Files:**

- Move:
  - `apps/desktop/tests/unit/components/command.test.tsx` -> `apps/desktop/src/components/ui/__tests__/command.test.tsx`
  - `apps/desktop/tests/unit/components/markdown-finalizer.test.ts` -> `apps/desktop/src/components/ui/__tests__/markdown-finalizer.test.ts`
  - `apps/desktop/tests/unit/components/markdown-sanitizer.test.ts` -> `apps/desktop/src/components/ui/__tests__/markdown-sanitizer.test.ts`
  - `apps/desktop/tests/unit/components/markdown-streaming.test.tsx` -> `apps/desktop/src/components/ui/__tests__/markdown-streaming.test.tsx`
  - `apps/desktop/tests/unit/components/markdown.test.tsx` -> `apps/desktop/src/components/ui/__tests__/markdown.test.tsx`
  - `apps/desktop/tests/unit/components/virtualized-list.test.tsx` -> `apps/desktop/src/components/ui/__tests__/virtualized-list.test.tsx`
  - `apps/desktop/tests/unit/components/model-selector-command-center.test.tsx` -> `apps/desktop/src/components/__tests__/model-selector-command-center.test.tsx`
  - `apps/desktop/tests/unit/views/model-selector.test.tsx` -> `apps/desktop/src/components/__tests__/model-selector.test.tsx`
  - `apps/desktop/tests/unit/components/settings-dialog/models-settings.test.tsx` -> `apps/desktop/src/components/settings-dialog/__tests__/models-settings.test.tsx`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run apps/desktop/src/components/ui/__tests__/command.test.tsx
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact paths above. Fix any path/import fallout using existing `@/` aliases only.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/components/ui/__tests__/command.test.tsx \
  src/components/ui/__tests__/markdown.test.tsx \
  src/components/ui/__tests__/markdown-streaming.test.tsx \
  src/components/__tests__/model-selector.test.tsx \
  src/components/settings-dialog/__tests__/models-settings.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/components apps/desktop/tests/unit/components apps/desktop/tests/unit/views/model-selector.test.tsx
git commit -m "test(desktop): colocate component and ui tests under nearest __tests__"
```

---

### Task 3: Move Home View Tests

**Files:**

- Move:
  - `apps/desktop/tests/unit/views/home-view/archived-workspace-item.test.tsx` -> `apps/desktop/src/views/home-view/components/__tests__/archived-workspace-item.test.tsx`
  - `apps/desktop/tests/unit/views/home-view/empty-state.test.tsx` -> `apps/desktop/src/views/home-view/components/__tests__/empty-state.test.tsx`
  - `apps/desktop/tests/unit/views/home-view/keyboard-shortcuts-footer.test.tsx` -> `apps/desktop/src/views/home-view/components/__tests__/keyboard-shortcuts-footer.test.tsx`
  - `apps/desktop/tests/unit/views/home-view/new-workspace-dialog.test.tsx` -> `apps/desktop/src/views/home-view/components/__tests__/new-workspace-dialog.test.tsx`
  - `apps/desktop/tests/unit/views/home-view/search-bar.test.tsx` -> `apps/desktop/src/views/home-view/components/__tests__/search-bar.test.tsx`
  - `apps/desktop/tests/unit/views/home-view/workspace-card.test.tsx` -> `apps/desktop/src/views/home-view/components/__tests__/workspace-card.test.tsx`
  - `apps/desktop/tests/unit/views/home-view/workspace-dashboard.test.tsx` -> `apps/desktop/src/views/home-view/components/__tests__/workspace-dashboard.test.tsx`
  - `apps/desktop/tests/unit/views/home-view/types.test.ts` -> `apps/desktop/src/views/home-view/__tests__/types.test.ts`
  - `apps/desktop/tests/unit/views/home-view/use-workspace-navigation.test.ts` -> `apps/desktop/src/hooks/__tests__/use-workspace-navigation.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/views/home-view/components/__tests__/workspace-card.test.tsx
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact mappings above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/views/home-view/components/__tests__/workspace-card.test.tsx \
  src/views/home-view/components/__tests__/workspace-dashboard.test.tsx \
  src/views/home-view/components/__tests__/new-workspace-dialog.test.tsx \
  src/hooks/__tests__/use-workspace-navigation.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/views/home-view apps/desktop/src/hooks apps/desktop/tests/unit/views/home-view
git commit -m "test(desktop): colocate home view tests under nearest __tests__"
```

---

### Task 4: Move Workspace Chat-Area and Task-List Tests

**Files:**

- Move:
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/basic-tool.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/tools/__tests__/basic-tool.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/chat-input.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/input/__tests__/chat-input.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/chat-perf-panel.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/perf/__tests__/chat-perf-panel.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/message-timeline.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/timeline/__tests__/message-timeline.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/part-registry.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/parts/__tests__/part-registry.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/permission-part.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/parts/__tests__/permission-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/question-part.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/parts/__tests__/question-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/reasoning-part.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/parts/__tests__/reasoning-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/retry-part.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/parts/__tests__/retry-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/text-part.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/parts/__tests__/text-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/tool-part.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/parts/__tests__/tool-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/session-turn.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/timeline/__tests__/session-turn.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/tool-registry.test.tsx` -> `apps/desktop/src/views/workspace-view/chat-area/tools/__tests__/tool-registry.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/right-side/tasks/task-list.test.tsx` -> `apps/desktop/src/views/workspace-view/right-side/tasks/__tests__/task-list.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/retry-timing.test.ts` -> `apps/desktop/src/utils/__tests__/retry-timing.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/views/workspace-view/chat-area/parts/__tests__/question-part.test.tsx
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact mappings above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/views/workspace-view/chat-area/parts/__tests__/question-part.test.tsx \
  src/views/workspace-view/chat-area/input/__tests__/chat-input.test.tsx \
  src/views/workspace-view/chat-area/timeline/__tests__/message-timeline.test.tsx \
  src/views/workspace-view/right-side/tasks/__tests__/task-list.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/views/workspace-view apps/desktop/src/utils apps/desktop/tests/unit/views/workspace-view
git commit -m "test(desktop): colocate workspace view tests under nearest __tests__"
```

---

### Task 5: Move Core Chat Domain Tests (Including Event Guards)

**Files:**

- Move:
  - `apps/desktop/tests/unit/core/chat/contracts/part-guards.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/part-guards.test.ts`
  - `apps/desktop/tests/unit/core/chat/reconciliation/correlation.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/correlation.test.ts`
  - `apps/desktop/tests/unit/core/chat/reconciliation/reconciliation.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/reconciliation.test.ts`
  - `apps/desktop/tests/unit/core/domain/event-deduplication.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/event-deduplication.test.ts`
  - `apps/desktop/tests/unit/core/domain/event-ordering.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/event-ordering.test.ts`
  - `apps/desktop/tests/unit/core/domain/event-router-adapter.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/event-router-adapter.test.ts`
  - `apps/desktop/tests/unit/core/domain/event-router.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/event-router.test.ts`
  - `apps/desktop/tests/unit/core/domain/message/message-events.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/message-events.test.ts`
  - `apps/desktop/tests/unit/core/domain/part/part-events.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/part-events.test.ts`
  - `apps/desktop/tests/unit/core/domain/part/part-queries.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/part-queries.test.ts`
  - `apps/desktop/tests/unit/core/domain/session/session-events.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/session-events.test.ts`
  - `apps/desktop/tests/unit/core/domain/session/session-queries.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/session-queries.test.ts`
  - `apps/desktop/tests/unit/event-guards.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/event-guards.test.ts`
  - `apps/desktop/tests/unit/shared/event-guards-strict.test.ts` -> `apps/desktop/src/core/chat/domain/__tests__/event-guards-strict.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/domain/__tests__/event-router.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact mappings above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/core/chat/domain/__tests__/event-router.test.ts \
  src/core/chat/domain/__tests__/event-router-adapter.test.ts \
  src/core/chat/domain/__tests__/event-guards.test.ts \
  src/core/chat/domain/__tests__/event-guards-strict.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/chat/domain apps/desktop/tests/unit/core apps/desktop/tests/unit/event-guards.test.ts apps/desktop/tests/unit/shared/event-guards-strict.test.ts
git commit -m "test(desktop): colocate core chat domain tests under nearest __tests__"
```

---

### Task 6: Move Core Chat Hooks and Services Tests

**Files:**

- Move:
  - `apps/desktop/tests/unit/core/chat/hooks/turn-projection.test.ts` -> `apps/desktop/src/core/chat/hooks/__tests__/turn-projection.test.ts`
  - `apps/desktop/tests/unit/core/chat/hooks/use-session-turns.test.ts` -> `apps/desktop/src/core/chat/hooks/__tests__/use-session-turns.test.ts`
  - `apps/desktop/tests/unit/core/chat/hooks/use-status-throttled-value.test.tsx` -> `apps/desktop/src/core/chat/hooks/__tests__/use-status-throttled-value.test.tsx`
  - `apps/desktop/tests/unit/core/chat/hooks/use-tasks.test.ts` -> `apps/desktop/src/core/chat/hooks/__tests__/use-tasks.test.ts`
  - `apps/desktop/tests/unit/core/chat/hooks/use-throttled-value.test.tsx` -> `apps/desktop/src/core/chat/hooks/__tests__/use-throttled-value.test.tsx`
  - `apps/desktop/tests/unit/presentation/hooks/use-chat-session.test.ts` -> `apps/desktop/src/core/chat/hooks/__tests__/use-chat-session.test.ts`
  - `apps/desktop/tests/unit/presentation/hooks/use-chat.test.ts` -> `apps/desktop/src/core/chat/hooks/__tests__/use-chat.test.ts`
  - `apps/desktop/tests/unit/presentation/hooks/use-messages.test.ts` -> `apps/desktop/src/core/chat/hooks/__tests__/use-messages.test.ts`
  - `apps/desktop/tests/unit/presentation/hooks/use-streaming.test.ts` -> `apps/desktop/src/core/chat/hooks/__tests__/use-streaming.test.ts`
  - `apps/desktop/tests/unit/core/chat/services/chat-perf-telemetry.test.ts` -> `apps/desktop/src/core/chat/services/__tests__/chat-perf-telemetry.test.ts`
  - `apps/desktop/tests/unit/core/chat/services/markdown-perf-telemetry.test.ts` -> `apps/desktop/src/core/chat/services/__tests__/markdown-perf-telemetry.test.ts`
  - `apps/desktop/tests/unit/core/chat/services/stream-update-coalescer.test.ts` -> `apps/desktop/src/core/chat/services/__tests__/stream-update-coalescer.test.ts`
  - `apps/desktop/tests/unit/core/services/stream-parser.test.ts` -> `apps/desktop/src/core/chat/services/__tests__/stream-parser.service.test.ts`
  - `apps/desktop/tests/unit/lib/chat/chat-stream-parser.test.ts` -> `apps/desktop/src/core/chat/services/__tests__/chat-stream-parser.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/core/chat/hooks/__tests__/use-chat.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact mappings above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/core/chat/hooks/__tests__/use-chat.test.ts \
  src/core/chat/hooks/__tests__/use-throttled-value.test.tsx \
  src/core/chat/services/__tests__/chat-stream-parser.test.ts \
  src/core/chat/services/__tests__/stream-parser.service.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/chat/hooks apps/desktop/src/core/chat/services apps/desktop/tests/unit/core/chat apps/desktop/tests/unit/presentation/hooks apps/desktop/tests/unit/core/services apps/desktop/tests/unit/lib/chat
git commit -m "test(desktop): colocate core chat hooks and services tests"
```

---

### Task 7: Move Core State Context/Provider/Store Tests

**Files:**

- Move:
  - `apps/desktop/tests/unit/presentation/contexts/message-context.test.tsx` -> `apps/desktop/src/core/state/contexts/__tests__/message-context.test.tsx`
  - `apps/desktop/tests/unit/presentation/contexts/part-context.test.ts` -> `apps/desktop/src/core/state/contexts/__tests__/part-context.test.ts`
  - `apps/desktop/tests/unit/presentation/contexts/session-context.test.tsx` -> `apps/desktop/src/core/state/contexts/__tests__/session-context.test.tsx`
  - `apps/desktop/tests/unit/presentation/contexts/ui-context.test.ts` -> `apps/desktop/src/core/state/contexts/__tests__/ui-context.test.ts`
  - `apps/desktop/tests/unit/presentation/providers/app-provider.test.tsx` -> `apps/desktop/src/core/state/providers/__tests__/app-provider.test.tsx`
  - `apps/desktop/tests/unit/presentation/providers/chat-provider.test.tsx` -> `apps/desktop/src/core/state/providers/__tests__/chat-provider.test.tsx`
  - `apps/desktop/tests/unit/presentation/providers/store-provider.test.tsx` -> `apps/desktop/src/core/state/providers/__tests__/store-provider.test.tsx`
  - `apps/desktop/tests/unit/presentation/providers/workspace-chat-provider.test.tsx` -> `apps/desktop/src/core/state/providers/__tests__/workspace-chat-provider.test.tsx`
  - `apps/desktop/tests/unit/core/state/providers/provider-catalog-store.test.ts` -> `apps/desktop/src/core/state/providers/__tests__/provider-catalog-store.test.ts`
  - `apps/desktop/tests/unit/core/state/providers/provider-selection-store.snapshot-search.test.ts` -> `apps/desktop/src/core/state/providers/__tests__/provider-selection-store.snapshot-search.test.ts`
  - `apps/desktop/tests/unit/core/state/providers/provider-selection-store.test.ts` -> `apps/desktop/src/core/state/providers/__tests__/provider-selection-store.test.ts`
  - `apps/desktop/tests/unit/core/state/stores/permission-store.test.ts` -> `apps/desktop/src/core/state/stores/__tests__/permission-store.test.ts`
  - `apps/desktop/tests/unit/core/state/stores/question-store.test.ts` -> `apps/desktop/src/core/state/stores/__tests__/question-store.test.ts`
  - `apps/desktop/tests/unit/core/stores/message-store-fk.test.ts` -> `apps/desktop/src/core/state/stores/__tests__/message-store-fk.test.ts`
  - `apps/desktop/tests/unit/core/stores/message-store.test.ts` -> `apps/desktop/src/core/state/stores/__tests__/message-store.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/core/state/providers/__tests__/store-provider.test.tsx
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact mappings above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/core/state/providers/__tests__/store-provider.test.tsx \
  src/core/state/providers/__tests__/provider-selection-store.test.ts \
  src/core/state/contexts/__tests__/message-context.test.tsx \
  src/core/state/stores/__tests__/message-store.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/state apps/desktop/tests/unit/presentation/contexts apps/desktop/tests/unit/presentation/providers apps/desktop/tests/unit/core/state apps/desktop/tests/unit/core/stores
git commit -m "test(desktop): colocate core state tests under nearest __tests__"
```

---

### Task 8: Move Infrastructure API/SSE Tests

**Files:**

- Move:
  - `apps/desktop/tests/unit/infrastructure/api/api-client-provider-selection.test.ts` -> `apps/desktop/src/core/services/api/__tests__/api-client-provider-selection.test.ts`
  - `apps/desktop/tests/unit/infrastructure/api/provider-client.test.ts` -> `apps/desktop/src/core/services/api/__tests__/provider-client.test.ts`
  - `apps/desktop/tests/unit/infrastructure/api/sdk-client.test.ts` -> `apps/desktop/src/core/services/api/__tests__/sdk-client.test.ts`
  - `apps/desktop/tests/unit/infrastructure/events/event-coalescer.test.ts` -> `apps/desktop/src/core/services/sse/__tests__/event-coalescer.test.ts`
  - `apps/desktop/tests/unit/infrastructure/events/event-source.test.ts` -> `apps/desktop/src/core/services/sse/__tests__/event-source.test.ts`
  - `apps/desktop/tests/unit/infrastructure/events/sse-catchup-refetch.test.ts` -> `apps/desktop/src/core/services/sse/__tests__/sse-catchup-refetch.test.ts`
  - `apps/desktop/tests/unit/infrastructure/events/sse-manager.test.ts` -> `apps/desktop/src/core/services/sse/__tests__/sse-manager.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/core/services/sse/__tests__/event-source.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact mappings above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/core/services/api/__tests__/sdk-client.test.ts \
  src/core/services/sse/__tests__/event-source.test.ts \
  src/core/services/sse/__tests__/sse-catchup-refetch.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/services/api apps/desktop/src/core/services/sse apps/desktop/tests/unit/infrastructure
git commit -m "test(desktop): colocate infrastructure api and sse tests"
```

---

### Task 9: Move Shared Utility and Catch-Up Tests

**Files:**

- Move:
  - `apps/desktop/tests/unit/core/shared/frame-budget-scheduler.test.ts` -> `apps/desktop/src/core/shared/utils/__tests__/frame-budget-scheduler.test.ts`
  - `apps/desktop/tests/unit/sse-catchup.test.ts` -> `apps/desktop/src/core/shared/utils/__tests__/sse-catchup.test.ts`
  - `apps/desktop/tests/unit/utils/create-auto-scroll.test.ts` -> `apps/desktop/src/core/shared/utils/__tests__/create-auto-scroll.test.ts`
  - `apps/desktop/tests/unit/utils/performance.test.ts` -> `apps/desktop/src/core/shared/utils/__tests__/performance.test.ts`
  - `apps/desktop/tests/unit/utils/reactive-performance.test.ts` -> `apps/desktop/src/core/shared/utils/__tests__/reactive-performance.test.ts`

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run src/core/shared/utils/__tests__/performance.test.ts
```

**Step 2: Run test to verify it fails**

Expected: FAIL (file does not exist yet).

**Step 3: Write minimal implementation**

Move files with `git mv` using exact mappings above.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  src/core/shared/utils/__tests__/performance.test.ts \
  src/core/shared/utils/__tests__/create-auto-scroll.test.ts \
  src/core/shared/utils/__tests__/sse-catchup.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/src/core/shared/utils apps/desktop/tests/unit/core/shared apps/desktop/tests/unit/sse-catchup.test.ts apps/desktop/tests/unit/utils
git commit -m "test(desktop): colocate shared utility tests under nearest __tests__"
```

---

### Task 10: Remove `tests/unit/**` Discovery and Add Layout Guardrail

**Files:**

- Create: `apps/desktop/scripts/check-no-tests-unit.sh`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/vitest.config.ts`
- Modify: `apps/desktop/docs/architecture/testing-strategy.md`

**Step 1: Write the failing test**

Create guardrail script:

```bash
#!/usr/bin/env bash
set -euo pipefail
if rg --files apps/desktop/tests/unit | grep -q .; then
  echo "Found forbidden files under apps/desktop/tests/unit"
  exit 1
fi
```

**Step 2: Run test to verify it fails**

Run:

```bash
bash apps/desktop/scripts/check-no-tests-unit.sh
```

Expected: FAIL until all unit files are moved/removed.

**Step 3: Write minimal implementation**

- Update `vitest.config.ts`:
  - Remove `tests/unit/**` includes from all projects.
  - Keep `src/**/__tests__/**/*.test.ts[x]`, `tests/integration/**`, `tests/e2e/**`.
- Add `package.json` script:
  - `"test:layout": "bash ./scripts/check-no-tests-unit.sh"`
- Update testing strategy doc to explicitly state nearest-`__tests__` placement is complete and mandatory.
- Remove empty `apps/desktop/tests/unit` directories.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop run test:layout
pnpm --filter @sakti-code/desktop run test:unit
pnpm --filter @sakti-code/desktop run test:ui
pnpm --filter @sakti-code/desktop run test:integration
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/desktop/scripts/check-no-tests-unit.sh apps/desktop/package.json apps/desktop/vitest.config.ts apps/desktop/docs/architecture/testing-strategy.md apps/desktop/tests/unit
git commit -m "test(desktop): enforce nearest __tests__ layout and remove tests/unit discovery"
```

---

### Task 11: Final Quality Gates and Merge Readiness

**Files:**

- Modify: none expected (verification-only; only commit if fixes are required)

**Step 1: Write the failing test**

Run full gate suite:

```bash
pnpm --filter @sakti-code/desktop run lint
pnpm --filter @sakti-code/desktop run typecheck:test
pnpm --filter @sakti-code/desktop run test:run
pnpm --filter @sakti-code/desktop run test:layout
```

**Step 2: Run test to verify it fails**

Expected: If any failures appear, treat them as regressions and fix in smallest possible follow-up commits.

**Step 3: Write minimal implementation**

Apply only minimal fixes required to pass all gates (no opportunistic refactors).

**Step 4: Run test to verify it passes**

Re-run exact commands above; expected PASS for all.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore(desktop-tests): finalize nearest __tests__ colocation migration"
```

---

## End-State Acceptance Criteria

1. `apps/desktop/tests/unit/**` no longer contains test files.
2. Unit/component/hook tests live under nearest `apps/desktop/src/**/__tests__/`.
3. `apps/desktop/tests/integration/**` and `apps/desktop/tests/e2e/**` remain centralized.
4. `pnpm --filter @sakti-code/desktop run lint` passes.
5. `pnpm --filter @sakti-code/desktop run typecheck:test` passes.
6. `pnpm --filter @sakti-code/desktop run test:run` passes.
7. `pnpm --filter @sakti-code/desktop run test:layout` passes.

## Notes for Execution

- Keep existing `@/` alias imports during this migration.
- Do not start `#*` subpath migration in this same branch.
- If import/typing failures occur during moves, fix pathing only; do not rewrite test behavior.
- Use `@verification-before-completion` before claiming each task complete.
