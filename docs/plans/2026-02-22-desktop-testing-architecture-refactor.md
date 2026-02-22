# Desktop Testing Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `apps/desktop` testing so imports are stable, tests are colocated with source where appropriate, Solid/Vite/Vitest integration is deterministic, and both runtime tests and test typechecking become reliable quality gates.

**Architecture:** Use a hybrid test layout: colocate unit/component/hook tests under `src/**`, keep cross-module integration and e2e contract flows under `tests/integration` and `tests/e2e`. Split Vitest into explicit projects (`node` vs `jsdom`), unify alias resolution across TypeScript/Vite/Vitest, and enforce lint guardrails that prevent path-drift regressions.

**Tech Stack:** Solid.js, Vite 7, Vitest 4, TypeScript 5.9, pnpm workspace, ESLint 9, `@solidjs/testing-library`, `@testing-library/user-event`, `@testing-library/jest-dom`.

---

## Baseline Snapshot (must be captured before editing)

- Current passing signal is misleading:
  - `pnpm --filter @sakti-code/desktop typecheck` passes because `apps/desktop/tsconfig.json` excludes tests.
- Current runtime failures:
  - `pnpm --filter @sakti-code/desktop test:run` fails with **15 failed suites**.
  - High-frequency root cause: `TypeError: Unknown file extension ".jsx"` from `lucide-solid`.
  - Additional root causes: stale imports in `tests/unit/views/model-selector.test.tsx` and `tests/unit/views/provider-settings.test.tsx`.
- Hidden compile failures:
  - `pnpm --filter @sakti-code/desktop exec tsc -p tests/tsconfig.json --noEmit` fails with large TS error set:
    - alias/path drift
    - missing declarations
    - stale import paths
    - `unknown`/unsafe helper typing
    - event fixture type mismatches.

Use `@systematic-debugging` any time an expected pass still fails after implementing a task.

---

### Task 1: Freeze the Baseline and Add a Desktop Test Health Script

**Files:**

- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/scripts/test-health.sh`
- Test: `apps/desktop/scripts/test-health.sh`

**Step 1: Write the failing test**

```bash
# apps/desktop/scripts/test-health.sh
#!/usr/bin/env bash
set -euo pipefail

pnpm --filter @sakti-code/desktop test:run
pnpm --filter @sakti-code/desktop exec tsc -p tests/tsconfig.json --noEmit
```

**Step 2: Run test to verify it fails**

Run: `bash apps/desktop/scripts/test-health.sh`
Expected: FAIL with current known issues (15 failed suites + test TS errors).

**Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "test:health": "bash ./scripts/test-health.sh"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @sakti-code/desktop test:health`
Expected: Still FAIL (intentional for baseline); script is now reproducible and committed.

**Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/scripts/test-health.sh
git commit -m "chore(desktop-tests): add baseline health check script"
```

---

### Task 2: Split TypeScript Config into App and Test Projects (Deterministic Ownership)

**Files:**

- Create: `apps/desktop/tsconfig.app.json`
- Create: `apps/desktop/tsconfig.spec.json`
- Modify: `apps/desktop/tsconfig.json`
- Modify: `apps/desktop/tests/tsconfig.json`
- Test: `apps/desktop/tsconfig.spec.json`

**Step 1: Write the failing test**

```bash
pnpm --filter @sakti-code/desktop exec tsc -p tests/tsconfig.json --noEmit
```

Expected failure includes TS2307/TS7017 and path/declaration breakages.

**Step 2: Run test to verify it fails**

Run command above and capture first 20 lines of output in notes.

**Step 3: Write minimal implementation**

```json
// apps/desktop/tsconfig.json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.spec.json" }]
}
```

```json
// apps/desktop/tsconfig.app.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "baseUrl": ".",
    "paths": {
      "@sakti-code/core/chat": ["../../packages/core/src/chat"],
      "@sakti-code/core/server": ["../../packages/core/src/server"],
      "@sakti-code/core/tools": ["../../packages/core/src/tools"],
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/views/*": ["src/views/*"],
      "@/core/*": ["src/core/*"],
      "@/state/*": ["src/core/state/*"],
      "@/services/*": ["src/core/services/*"],
      "@/shared/*": ["src/core/shared/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": ["src/**/*", "vite.config.ts", "vitest.config.ts"]
}
```

```json
// apps/desktop/tsconfig.spec.json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "types": ["vitest/globals", "vite/client"],
    "noEmit": true
  },
  "include": ["src/**/*", "src/env.d.ts", "tests/**/*.ts", "tests/**/*.tsx", "vitest.config.ts"]
}
```

```json
// apps/desktop/tests/tsconfig.json (keep as compatibility shim)
{
  "extends": "../tsconfig.spec.json"
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit`
Expected: No TS2307 from path ownership/config itself; remaining semantic test errors are handled in later tasks.

**Step 5: Commit**

```bash
git add apps/desktop/tsconfig.json apps/desktop/tsconfig.app.json apps/desktop/tsconfig.spec.json apps/desktop/tests/tsconfig.json
git commit -m "chore(desktop-tests): split app/spec tsconfig ownership"
```

---

### Task 3: Split Vitest into Projects and Fix Solid Dependency Loading

**Files:**

- Create: `apps/desktop/vitest.shared.ts`
- Modify: `apps/desktop/vitest.config.ts`
- Modify: `apps/desktop/package.json`
- Test: `apps/desktop/tests/unit/components/command.test.tsx`

**Step 1: Write the failing test**

```bash
pnpm --filter @sakti-code/desktop exec vitest run tests/unit/components/command.test.tsx
```

Expected: FAIL with `Unknown file extension ".jsx"` from `lucide-solid`.

**Step 2: Run test to verify it fails**

Run command above and record stack once.

**Step 3: Write minimal implementation**

```ts
// apps/desktop/vitest.shared.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/vitest.setup.ts"],
    server: {
      deps: {
        inline: [
          "@solidjs/router",
          "@kobalte/core",
          "@kobalte/core/collapsible",
          "@corvu/utils",
          "@corvu/resizable",
          "solid-presence",
          "solid-prevent-scroll",
          "lucide-solid",
        ],
      },
    },
    deps: {
      optimizer: {
        web: {
          include: ["solid-js", "solid-js/web", "@solidjs/router", "lucide-solid"],
        },
      },
    },
  },
});
```

```ts
// apps/desktop/vitest.config.ts (projects split)
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "./vitest.shared";
import solid from "vite-plugin-solid";

export default mergeConfig(
  shared,
  defineConfig({
    plugins: [solid()],
    test: {
      projects: [
        {
          test: {
            name: "desktop-unit-node",
            include: ["src/**/*.test.ts"],
            environment: "node",
          },
        },
        {
          test: {
            name: "desktop-ui-jsdom",
            include: ["src/**/*.test.tsx", "tests/integration/**/*.test.tsx"],
            environment: "jsdom",
          },
        },
        {
          test: {
            name: "desktop-contract",
            include: ["tests/e2e/**/*.test.ts", "tests/integration/**/*.test.ts"],
            environment: "jsdom",
          },
        },
      ],
    },
  })
);
```

```json
{
  "scripts": {
    "test:unit": "vitest run --project desktop-unit-node",
    "test:ui": "vitest run --project desktop-ui-jsdom",
    "test:integration": "vitest run --project desktop-contract"
  }
}
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop exec vitest run tests/unit/components/command.test.tsx`
- `pnpm --filter @sakti-code/desktop test:unit`

Expected: no `.jsx` extension loader failure.

**Step 5: Commit**

```bash
git add apps/desktop/vitest.config.ts apps/desktop/vitest.shared.ts apps/desktop/package.json
git commit -m "test(desktop): split vitest projects and inline lucide-solid deps"
```

---

### Task 4: Install Solid Testing Library Baseline and Global Setup Hygiene

**Files:**

- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/test/setup.ts`
- Modify: `apps/desktop/vitest.shared.ts`
- Test: `apps/desktop/src/test/setup.ts`

**Step 1: Write the failing test**

```ts
// apps/desktop/src/test/setup.ts
import "@testing-library/jest-dom/vitest";
```

Before install, this import fails.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-ui-jsdom --passWithNoTests`
Expected: FAIL missing dependency before installation.

**Step 3: Write minimal implementation**

```json
{
  "devDependencies": {
    "@solidjs/testing-library": "^0.8.0",
    "@testing-library/user-event": "^14.6.1",
    "@testing-library/jest-dom": "^6.6.3"
  }
}
```

```ts
// apps/desktop/vitest.shared.ts
test: {
  setupFiles: ["./src/test/setup.ts", "./tests/vitest.setup.ts"];
}
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm install`
- `pnpm --filter @sakti-code/desktop exec vitest run --project desktop-ui-jsdom --passWithNoTests`

Expected: setup loads with no module resolution errors.

**Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src/test/setup.ts apps/desktop/vitest.shared.ts pnpm-lock.yaml
git commit -m "test(desktop): add solid testing-library baseline"
```

---

### Task 5: Type `tests/vitest.setup.ts` and Add Test Globals Declaration

**Files:**

- Modify: `apps/desktop/tests/vitest.setup.ts`
- Create: `apps/desktop/tests/types/globals.d.ts`
- Modify: `apps/desktop/tsconfig.spec.json`
- Test: `apps/desktop/tests/vitest.setup.ts`

**Step 1: Write the failing test**

Run: `pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit`
Expected failure includes TS7017 from `tests/vitest.setup.ts`.

**Step 2: Run test to verify it fails**

Capture TS7017 references once.

**Step 3: Write minimal implementation**

```ts
// apps/desktop/tests/types/globals.d.ts
export {};

declare global {
  interface Window {
    SpeechRecognition?: typeof globalThis.SpeechRecognition;
    SpeechGrammarList?: typeof globalThis.SpeechGrammarList;
    SpeechRecognitionEvent?: typeof globalThis.SpeechRecognitionEvent;
  }
}
```

```ts
// apps/desktop/tests/vitest.setup.ts
class MockSpeechRecognition implements SpeechRecognition {
  // implement required members with explicit types, no unknown/any
}
```

```json
// tsconfig.spec include
"include": ["src/**/*", "tests/**/*.ts", "tests/**/*.tsx", "tests/types/**/*.d.ts", "src/env.d.ts"]
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit`
Expected: no TS7017 from vitest setup.

**Step 5: Commit**

```bash
git add apps/desktop/tests/vitest.setup.ts apps/desktop/tests/types/globals.d.ts apps/desktop/tsconfig.spec.json
git commit -m "test(desktop): type vitest speech mocks and test globals"
```

---

### Task 6: Create Canonical `src/test-utils` and Replace Raw `solid-js/web` Render Helpers

**Files:**

- Create: `apps/desktop/src/test-utils/render.tsx`
- Create: `apps/desktop/src/test-utils/async.ts`
- Create: `apps/desktop/src/test-utils/index.ts`
- Modify: `apps/desktop/tests/helpers/test-providers.tsx`
- Test: `apps/desktop/tests/helpers/test-providers.tsx`

**Step 1: Write the failing test**

```ts
// new usage target (failing before helper exists)
import { renderWithProviders } from "@/test-utils";
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sakti-code/desktop exec vitest run tests/integration/provider-initialization-order.test.tsx`
Expected: fail until helper and imports are migrated.

**Step 3: Write minimal implementation**

```ts
// src/test-utils/render.tsx
import { render } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { TestProviders } from "../../../tests/helpers/test-providers";

export function renderWithProviders(ui: () => JSX.Element) {
  return render(() => <TestProviders>{ui()}</TestProviders>);
}
```

```ts
// src/test-utils/async.ts
export async function flushMicrotasks(times = 2): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop exec vitest run tests/integration/provider-initialization-order.test.tsx`

Expected: passes with `@solidjs/testing-library` render path.

**Step 5: Commit**

```bash
git add apps/desktop/src/test-utils apps/desktop/tests/helpers/test-providers.tsx
git commit -m "test(desktop): add canonical test-utils and provider render helper"
```

---

### Task 7: Fix Stale Imports and Rename Obsolete View Tests

**Files:**

- Modify: `apps/desktop/tests/unit/views/model-selector.test.tsx`
- Move/Replace: `apps/desktop/tests/unit/views/provider-settings.test.tsx`
- Create: `apps/desktop/tests/unit/components/settings-dialog/models-settings.test.tsx`
- Test: `apps/desktop/tests/unit/views/model-selector.test.tsx`

**Step 1: Write the failing test**

Run:

- `pnpm --filter @sakti-code/desktop exec vitest run tests/unit/views/model-selector.test.tsx`
- `pnpm --filter @sakti-code/desktop exec vitest run tests/unit/views/provider-settings.test.tsx`

Expected: fail with unresolved `@/views/components/...`.

**Step 2: Run test to verify it fails**

Capture the import-analysis error lines.

**Step 3: Write minimal implementation**

```ts
// model-selector.test.tsx
import { ModelSelector } from "@/components/model-selector";
```

```ts
// replace provider-settings test target
import { ModelsSettings } from "@/components/settings-dialog/models-settings";
```

Replace assertions to validate current UI labels/actions that exist in `models-settings.tsx`.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop exec vitest run tests/unit/views/model-selector.test.tsx`
- `pnpm --filter @sakti-code/desktop exec vitest run tests/unit/components/settings-dialog/models-settings.test.tsx`

Expected: both pass.

**Step 5: Commit**

```bash
git add apps/desktop/tests/unit/views/model-selector.test.tsx apps/desktop/tests/unit/views/provider-settings.test.tsx apps/desktop/tests/unit/components/settings-dialog/models-settings.test.tsx
git commit -m "test(desktop): align stale view tests with current component locations"
```

---

### Task 8: Migrate Failing UI Suites from `solid-js/web` to Testing Library

**Files:**

- Modify:
  - `apps/desktop/tests/unit/components/command.test.tsx`
  - `apps/desktop/tests/unit/components/model-selector-command-center.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/chat-input.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/message-timeline.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/session-turn.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/basic-tool.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/permission-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/question-part.test.tsx`
  - `apps/desktop/tests/unit/views/workspace-view/chat-area/parts/tool-part.test.tsx`
- Test: same files as above

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  tests/unit/components/command.test.tsx \
  tests/unit/components/model-selector-command-center.test.tsx \
  tests/unit/views/workspace-view/chat-area/chat-input.test.tsx
```

Expected: failing suites / 0 tests due import/runtime bootstrap issues.

**Step 2: Run test to verify it fails**

Record failures and keep as regression references.

**Step 3: Write minimal implementation**

Use `@solidjs/testing-library` patterns:

```ts
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";

test("sends message on Enter", async () => {
  const user = userEvent.setup();
  render(() => <ChatInput onSend={onSend} />);
  await user.type(screen.getByRole("textbox"), "hello{enter}");
  expect(onSend).toHaveBeenCalledWith("hello");
});
```

Remove manual container/dispose boilerplate where unnecessary.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @sakti-code/desktop exec vitest run \
  tests/unit/components/command.test.tsx \
  tests/unit/components/model-selector-command-center.test.tsx \
  tests/unit/views/workspace-view/chat-area/chat-input.test.tsx \
  tests/unit/views/workspace-view/chat-area/message-timeline.test.tsx \
  tests/unit/views/workspace-view/chat-area/session-turn.test.tsx \
  tests/unit/views/workspace-view/chat-area/basic-tool.test.tsx \
  tests/unit/views/workspace-view/chat-area/parts/permission-part.test.tsx \
  tests/unit/views/workspace-view/chat-area/parts/question-part.test.tsx \
  tests/unit/views/workspace-view/chat-area/parts/tool-part.test.tsx
```

Expected: all pass.

**Step 5: Commit**

```bash
git add apps/desktop/tests/unit/components apps/desktop/tests/unit/views/workspace-view/chat-area
git commit -m "test(desktop): migrate high-risk ui suites to solid testing-library"
```

---

### Task 9: Normalize Mock and Import Paths to Alias-Based Identity

**Files:**

- Modify:
  - `apps/desktop/tests/helpers/test-providers.tsx`
  - `apps/desktop/tests/helpers/fixture-loader.ts`
  - `apps/desktop/tests/helpers/event-handlers.ts`
  - `apps/desktop/tests/integration/home-workspace-provider-flow.test.tsx`
  - `apps/desktop/tests/integration/chat-stream-rendering.test.tsx`
  - `apps/desktop/tests/unit/infrastructure/events/sse-manager.test.ts`
  - `apps/desktop/tests/unit/views/home-view/new-workspace-dialog.test.tsx`
  - `apps/desktop/tests/unit/core/stores/message-store-fk.test.ts`
- Test: same files

**Step 1: Write the failing test**

Run:

```bash
rg -n "\.\./\.\./src|../../../../src|../src" apps/desktop/tests --glob '!**/*.json'
```

Expected: non-zero count (currently 23 matches).

**Step 2: Run test to verify it fails**

Baseline count should be greater than `0`.

**Step 3: Write minimal implementation**

Convert to alias imports:

```ts
// before
import { AppProvider } from "../../../../src/core/state/providers/app-provider";
// after
import { AppProvider } from "@/core/state/providers/app-provider";
```

For `vi.mock` and dynamic `import()`, keep alias paths:

```ts
vi.mock("@/core/services/sse/event-source", () => ({ ... }));
const mod = await import("@/core/services/sse/sse-manager");
```

**Step 4: Run test to verify it passes**

Run:

- `rg -n "\.\./\.\./src|../../../../src|../src" apps/desktop/tests --glob '!**/*.json'`
- `pnpm --filter @sakti-code/desktop exec vitest run tests/unit/infrastructure/events/sse-manager.test.ts`

Expected: `rg` count reaches `0`; targeted tests pass.

**Step 5: Commit**

```bash
git add apps/desktop/tests
git commit -m "refactor(desktop-tests): replace deep relative src imports with aliases"
```

---

### Task 10: Add Test-Only Lint Guardrails to Prevent Import Regression

**Files:**

- Modify: `eslint.config.js`
- Test: `apps/desktop/tests/**/*`

**Step 1: Write the failing test**

Add a temporary bad import in one test:

```ts
import { x } from "../../../../src/core/state/stores/message-store";
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @sakti-code/desktop lint`
Expected: lint fails with `no-restricted-imports` for deep relative src access.

**Step 3: Write minimal implementation**

```js
{
  files: ["apps/desktop/tests/**/*.ts", "apps/desktop/tests/**/*.tsx"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["../src/*", "../../src/*", "../../../src/*", "../../../../src/*"],
            message: "Use @/* aliases in desktop tests; never deep-relative into src."
          }
        ],
        paths: [
          {
            name: "solid-js/web",
            importNames: ["render"],
            message: "Use @solidjs/testing-library render for component tests."
          }
        ]
      }
    ]
  }
}
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop lint`
- `rg -n "from \"solid-js/web\"" apps/desktop/tests --glob '!**/*.json'`

Expected: no lint violations for migrated suites.

**Step 5: Commit**

```bash
git add eslint.config.js
git commit -m "chore(desktop-tests): enforce alias-based imports and testing-library render"
```

---

### Task 11: Introduce Typed Event Fixture Builders to Remove `unknown`/Shape Drift

**Files:**

- Create: `apps/desktop/tests/helpers/event-factories.ts`
- Modify:
  - `apps/desktop/tests/helpers/event-handlers.ts`
  - `apps/desktop/tests/unit/core/domain/event-router.test.ts`
  - `apps/desktop/tests/unit/infrastructure/events/event-coalescer.test.ts`
  - `apps/desktop/tests/unit/core/domain/message/message-events.test.ts`
  - `apps/desktop/tests/unit/core/domain/session/session-events.test.ts`
- Test: same files

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit
```

Expected failures around:

- missing `eventId/sequence/timestamp`
- literal widening (`role: string`)
- `unknown` draft callbacks.

**Step 2: Run test to verify it fails**

Capture first failing set in these test files.

**Step 3: Write minimal implementation**

```ts
// tests/helpers/event-factories.ts
import type { AllServerEvents, TypedServerEvent } from "@sakti-code/shared/event-types";

let sequence = 1;
export function makeEvent<T extends AllServerEvents["type"]>(
  type: T,
  properties: TypedServerEvent<T>["properties"]
): TypedServerEvent<T> {
  const seq = sequence++;
  return {
    type,
    properties,
    eventId: `evt-${seq}`,
    sequence: seq,
    timestamp: Date.now(),
  } as TypedServerEvent<T>;
}
```

Refactor fixtures/tests to call `makeEvent(...)` instead of object literals.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit`
- `pnpm --filter @sakti-code/desktop exec vitest run tests/unit/core/domain/event-router.test.ts tests/unit/infrastructure/events/event-coalescer.test.ts`

Expected: target type mismatch errors removed.

**Step 5: Commit**

```bash
git add apps/desktop/tests/helpers/event-factories.ts apps/desktop/tests/helpers/event-handlers.ts apps/desktop/tests/unit/core/domain apps/desktop/tests/unit/infrastructure/events/event-coalescer.test.ts
git commit -m "test(desktop): add typed server event factories for fixture consistency"
```

---

### Task 12: Resolve API Alias Drift in Integration and Infrastructure Tests

**Files:**

- Modify:
  - `apps/desktop/tests/integration/provider-initialization-order.test.tsx`
  - `apps/desktop/tests/unit/infrastructure/api/sdk-client.test.ts`
  - `apps/desktop/tests/unit/presentation/providers/store-provider.test.tsx`
- Test: same files

**Step 1: Write the failing test**

Run:

```bash
pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit
```

Expected TS2307 for:

- `@renderer/lib/api-client`
- `@/infrastructure/api/sdk-client`
- `@renderer/core/stores/message-store`

**Step 2: Run test to verify it fails**

Record these exact module failures.

**Step 3: Write minimal implementation**

```ts
// provider-initialization-order.test.tsx
import type { SaktiCodeApiClient } from "@/core/services/api/api-client";

// sdk-client.test.ts
import type { SDKClient } from "@/core/services/api/sdk-client";
import { createSDKClient } from "@/core/services/api/sdk-client";
```

Replace any legacy `@renderer/*` imports with `@/*` canonical paths.

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit`
- `pnpm --filter @sakti-code/desktop exec vitest run tests/integration/provider-initialization-order.test.tsx tests/unit/infrastructure/api/sdk-client.test.ts`

Expected: no unresolved alias errors.

**Step 5: Commit**

```bash
git add apps/desktop/tests/integration/provider-initialization-order.test.tsx apps/desktop/tests/unit/infrastructure/api/sdk-client.test.ts apps/desktop/tests/unit/presentation/providers/store-provider.test.tsx
git commit -m "refactor(desktop-tests): align test imports with canonical api aliases"
```

---

### Task 13: Decide E2E Contract Boundary and Declare Explicit Test Dependencies

**Files:**

- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/tests/helpers/test-server.ts`
- Test: `apps/desktop/tests/e2e/**/*.test.ts`

**Step 1: Write the failing test**

Run: `pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit`
Expected TS2307 for `@hono/node-server`, `hono`, `@sakti-code/server`.

**Step 2: Run test to verify it fails**

Confirm missing module declarations are reproducible.

**Step 3: Write minimal implementation**

Option chosen for this plan: keep e2e contract tests in desktop package, but declare dependencies explicitly.

```json
{
  "devDependencies": {
    "@hono/node-server": "^1.13.8",
    "hono": "^4.6.13",
    "@sakti-code/server": "workspace:*"
  }
}
```

Optionally isolate these tests under Vitest `desktop-contract` project if startup is slow.

**Step 4: Run test to verify it passes**

Run:

- `pnpm install`
- `pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit`
- `pnpm --filter @sakti-code/desktop exec vitest run tests/e2e/parity.test.ts`

Expected: no missing-module errors for e2e helper stack.

**Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/tests/helpers/test-server.ts pnpm-lock.yaml
git commit -m "test(desktop): declare explicit e2e server helper dependencies"
```

---

### Task 14: Colocate Unit/Component/Hook Tests with Source Modules

**Files:**

- Create: `apps/desktop/scripts/move-tests-to-colocation.mjs`
- Move:
  - `apps/desktop/tests/unit/core/**` -> `apps/desktop/src/core/**/__tests__/*`
  - `apps/desktop/tests/unit/components/**` -> `apps/desktop/src/components/**/__tests__/*`
  - `apps/desktop/tests/unit/views/**` -> `apps/desktop/src/views/**/__tests__/*`
  - `apps/desktop/tests/unit/presentation/**` -> `apps/desktop/src/core/state/**/__tests__/*`
- Modify: `apps/desktop/vitest.config.ts` include globs
- Test: moved test files

**Step 1: Write the failing test**

Create migration script dry-run mode:

```js
// scripts/move-tests-to-colocation.mjs
// 1) print source file + target file mapping
// 2) fail if target source module does not exist
```

**Step 2: Run test to verify it fails**

Run:

- `node apps/desktop/scripts/move-tests-to-colocation.mjs --dry-run`
  Expected: fails for any orphan tests (must be resolved before actual move).

**Step 3: Write minimal implementation**

After dry-run passes:

```bash
node apps/desktop/scripts/move-tests-to-colocation.mjs --apply
```

Update Vitest includes:

```ts
include: [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "tests/integration/**/*.test.ts?(x)",
  "tests/e2e/**/*.test.ts",
];
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop test:unit`
- `pnpm --filter @sakti-code/desktop test:ui`

Expected: moved suites discovered and passing.

**Step 5: Commit**

```bash
git add apps/desktop/scripts/move-tests-to-colocation.mjs apps/desktop/src apps/desktop/tests apps/desktop/vitest.config.ts
git commit -m "refactor(desktop-tests): colocate unit and component suites under src"
```

---

### Task 15: Preserve Centralized Integration/E2E Structure with Dedicated Helpers

**Files:**

- Modify: `apps/desktop/tests/helpers/test-providers.tsx`
- Modify: `apps/desktop/tests/helpers/fixture-loader.ts`
- Modify: `apps/desktop/tests/integration/*.test.tsx`
- Modify: `apps/desktop/tests/e2e/*.test.ts`
- Test: `apps/desktop/tests/integration/**/*.test.tsx`, `apps/desktop/tests/e2e/**/*.test.ts`

**Step 1: Write the failing test**

Run:

- `pnpm --filter @sakti-code/desktop test:integration`

Expected: any remaining integration breakages due moved unit utilities or stale helper paths.

**Step 2: Run test to verify it fails**

Capture failures, especially helper import locations.

**Step 3: Write minimal implementation**

Keep integration/e2e in centralized directories; route shared helpers through stable aliases:

```ts
import { applyFixture } from "@tests/helpers/fixture-loader";
import { renderWithProviders } from "@/test-utils";
```

Update `tsconfig.spec.json` paths with:

```json
"@tests/*": ["tests/*"]
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop test:integration`
- `pnpm --filter @sakti-code/desktop exec vitest run tests/e2e/data-integrity/full-lifecycle.test.ts`

Expected: cross-module suites pass without relative depth assumptions.

**Step 5: Commit**

```bash
git add apps/desktop/tests apps/desktop/tsconfig.spec.json
git commit -m "test(desktop): stabilize integration and e2e helper architecture"
```

---

### Task 16: Add Test Typecheck and Full Verification Gates

**Files:**

- Modify: `apps/desktop/package.json`
- Modify: `turbo.json`
- Modify: `package.json`
- Test: full desktop checks

**Step 1: Write the failing test**

Define required gate command:

```bash
pnpm --filter @sakti-code/desktop exec tsc -p tsconfig.spec.json --noEmit
```

Should fail before all prior fixes are complete.

**Step 2: Run test to verify it fails**

Confirm this fails pre-fix branch state.

**Step 3: Write minimal implementation**

```json
// apps/desktop/package.json
{
  "scripts": {
    "typecheck:test": "tsc -p tsconfig.spec.json --noEmit",
    "test:all": "pnpm run typecheck:test && vitest run"
  }
}
```

```json
// turbo.json
{
  "tasks": {
    "typecheck:test": {},
    "test": {}
  }
}
```

```json
// root package.json
{
  "scripts": {
    "typecheck:test": "turbo run typecheck:test"
  }
}
```

**Step 4: Run test to verify it passes**

Run:

- `pnpm --filter @sakti-code/desktop run typecheck:test`
- `pnpm --filter @sakti-code/desktop test:run`
- `pnpm --filter @sakti-code/desktop run test:all`

Expected: all green.

**Step 5: Commit**

```bash
git add apps/desktop/package.json turbo.json package.json
git commit -m "ci(desktop-tests): enforce test typecheck and full verification gates"
```

---

### Task 17: Document the New Desktop Testing Standards

**Files:**

- Create: `apps/desktop/docs/architecture/testing-strategy.md`
- Modify: `apps/desktop/docs/architecture/phase0-contracts.md`
- Test: documentation references are accurate

**Step 1: Write the failing test**

Add doc checklist that initially fails review if missing:

```md
- [ ] Unit tests colocated under src
- [ ] Integration/e2e under tests/
- [ ] No ../../src imports in tests
- [ ] test:typecheck required in CI
```

**Step 2: Run test to verify it fails**

Manual check: list not satisfied until doc is written.

**Step 3: Write minimal implementation**

Create `testing-strategy.md` with:

- layout policy
- import policy
- Solid testing-library conventions
- async testing rules for Suspense/resources/router
- mock and timer rules
- required commands (`typecheck:test`, `test:unit`, `test:ui`, `test:integration`, `test:all`)

**Step 4: Run test to verify it passes**

Run:

- `rg -n "typecheck:test|No ../../src imports|@solidjs/testing-library|projects" apps/desktop/docs/architecture/testing-strategy.md`

Expected: all required terms present.

**Step 5: Commit**

```bash
git add apps/desktop/docs/architecture/testing-strategy.md apps/desktop/docs/architecture/phase0-contracts.md
git commit -m "docs(desktop-tests): document testing architecture and enforcement rules"
```

---

### Task 18: Final Verification and Merge Readiness

**Files:**

- Verify: `apps/desktop/**`
- Verify: root config files touched by this plan

**Step 1: Write the failing test**

Final gate command list:

```bash
pnpm --filter @sakti-code/desktop run typecheck
pnpm --filter @sakti-code/desktop run typecheck:test
pnpm --filter @sakti-code/desktop run lint
pnpm --filter @sakti-code/desktop run test:run
pnpm --filter @sakti-code/desktop run test:all
```

Before full implementation, at least one of these fails.

**Step 2: Run test to verify it fails**

Run once before completing all tasks; confirm red.

**Step 3: Write minimal implementation**

No new code. Complete all remaining failing items uncovered by the final gate run, using:

- `@systematic-debugging` for unexpected failures
- `@verification-before-completion` before declaring done

**Step 4: Run test to verify it passes**

Run all final gate commands above.
Expected: all PASS.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(desktop-tests): complete testing architecture migration and quality gates"
```

---

## Acceptance Criteria

1. `pnpm --filter @sakti-code/desktop test:run` passes with zero failed suites.
2. `pnpm --filter @sakti-code/desktop run typecheck:test` passes.
3. No test imports use deep `../../src` patterns.
4. UI/component tests use `@solidjs/testing-library` by default.
5. Unit/component/hook tests are colocated under `src/**`; integration/e2e remain centralized under `tests/`.
6. Vitest project split exists and is documented.
7. Lint rules prevent reintroduction of fragile import patterns.

## Explicit Defaults and Assumptions

- Keep a **hybrid** layout (not fully colocated for integration/e2e).
- Keep Vitest for all current suites; Playwright adoption is intentionally out of scope for this refactor.
- Keep `@/*` alias as the canonical internal import identity in desktop package for this phase.
- E2E contract tests in desktop remain allowed to depend on server package in `devDependencies`.

## Out of Scope

- Rewriting all integration tests to Playwright.
- Refactoring runtime app architecture unrelated to testing.
- Replacing all aliases with Node `#` subpath imports in this same refactor.
