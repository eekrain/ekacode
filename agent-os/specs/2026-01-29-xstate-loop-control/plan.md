# Spec: XState Loop Control + Hierarchical Machine Design

**Folder:** `agent-os/specs/2026-01-29-xstate-loop-control/`
**Task:** ROADMAP #5 - Implement XState loop control + hierarchical machine design
**Scope:** Complete XState system (Plan + Build agents)

---

## Overview

**What we're building:** XState v5 hierarchical state machine for Plan/Build agent orchestration with intent-based loop control, dynamic tool routing per phase, and doom-loop detection guards.

**Key decisions:**
- Intent-based looping via `finishReason === 'stop'` (safety limits are backup only)
- Hierarchical states: plan (analyze → research → design) → build (implement ⇄ validate)
- Dynamic tool routing prevents wrong tools in wrong phases
- XState orchestrates, AI SDK executes LLM calls
- HybridAgent integration for multimodal capabilities
- **TDD approach** — Every file change followed by typecheck + lint verification

**Integration points:** HybridAgent, Plan/Build actors, Dynamic tool routing (all confirmed)

**Visuals:** None (design doc has ASCII diagrams)

**References:** new-integration.md (complete implementation design)

**Standards:** XState v5 (tech-stack), Zero TypeScript/ESLint errors (code-quality)

---

## Task Breakdown

### Task 1: Save Spec Documentation ✅
Create `agent-os/specs/2026-01-29-xstate-loop-control/` with:
- plan.md — This full plan
- shape.md — Shaping notes (scope, decisions, context)
- standards.md — Relevant standards (tech-stack, code-quality)
- references.md — Pointers to new-integration.md design
- visuals/ — State diagrams from new-integration.md (ASCII art preserved)

### Task 2: Install XState v5 Dependency
Add `xstate` to `packages/core/package.json`:

```json
{
  "dependencies": {
    "xstate": "^5.18.0"
  }
}
```

Run `pnpm install` to install the dependency.

**TDD Verification:**
```bash
pnpm --filter @ekacode/core typecheck
pnpm --filter @ekacode/core lint
```

### Task 3: Create XState Machine Structure
**TDD workflow for EACH file:**
1. Create test file first (in `packages/core/tests/state/`)
2. Run test — should fail (red)
3. Create source file to make test pass (green)
4. Run typecheck + lint — must pass
5. Move to next file

**Files to create:**
1. `packages/core/src/state/types.ts` — State machine types
2. `packages/core/src/state/machine.ts` — Hierarchical state machine
3. `packages/core/src/state/loop-control.ts` — Intent-based loop control

### Task 4: Implement XState Actors
**TDD workflow for EACH file:**
1. Create test file first (red)
2. Create source file (green)
3. Run typecheck + lint — must pass
4. Move to next file

**Files to create:**
1. `packages/core/src/state/actors/explore-agent.ts`
2. `packages/core/src/state/actors/plan-agent.ts`
3. `packages/core/src/state/actors/build-agent.ts`

### Task 5: Implement Dynamic Tool Routing
**TDD workflow for EACH file:**
1. Create test file first (red)
2. Create source file (green)
3. Run typecheck + lint — must pass
4. Move to next file

**Files to create:**
1. `packages/core/src/state/tools/tool-filter.ts`
2. `packages/core/src/state/tools/phase-tools.ts`

### Task 6: Implement Doom Loop Detection
**TDD workflow for EACH file:**
1. Create test file first (red)
2. Create source file (green)
3. Run typecheck + lint — must pass
4. Move to next file

**Files to create:**
1. `packages/core/src/state/guards/doom-loop.ts`

### Task 7: Wire HybridAgent Integration
**TDD workflow for EACH file:**
1. Create test file first (red)
2. Create source file (green)
3. Run typecheck + lint — must pass
4. Move to next file

**Files to create:**
1. `packages/core/src/state/integration/hybrid-agent.ts`
2. `packages/core/src/state/integration/model-provider.ts`

### Task 8: Create Phase-Specific System Prompts
**TDD workflow for EACH file:**
1. Create test file first (red)
2. Create source file (green)
3. Run typecheck + lint — must pass
4. Move to next file

**Files to create:**
1. `packages/core/src/state/prompts/plan-prompts.ts`
2. `packages/core/src/state/prompts/build-prompts.ts`

### Task 9: Verify All Tests Pass
Run all tests and ensure they pass:
```bash
pnpm --filter @ekacode/core test
```

### Task 10: Type Checking and Linting
Ensure zero TypeScript and ESLint errors:
```bash
pnpm --filter @ekacode/core typecheck
pnpm --filter @ekacode/core lint
```

---

## Dependencies

- `xstate@^5.18.0` — State machine framework
- `ai@^6.0.58` — Vercel AI SDK (existing)
- `@ekacode/zai` — Z.ai provider (existing)
- `@ekacode/core` tools — Tool registry (existing)

---

## Standards Applied

- **global/tech-stack** — XState v5 for agent orchestration, Vercel AI SDK v6 for LLM layer
- **global/code-quality** — Zero TypeScript/ESLint errors, tests in `tests/` directory

---

## References

- `.claude/research/plans/new-integration.md` — Complete XState integration design
- `agent-os/standards/global/tech-stack.md` — XState rationale
- `packages/core/src/agents/` — Existing agent patterns for integration context

---

## Decisions Made

1. **Intent-based looping** — Primary completion signal is `finishReason === 'stop'`, safety limits are backup only
2. **Hierarchical states** — Parent (plan/build) with child phases for clear workflow structure
3. **Dynamic tool routing** — Phase-specific tool sets prevent agent from using wrong tools
4. **XState for orchestration only** — LLM calls still use AI SDK `streamText()`, XState manages flow
5. **HybridAgent integration** — XState wraps HybridAgent for multimodal capabilities
6. **Separate state package** — State logic in `packages/core/src/state/` for clear separation from agent logic
7. **TDD approach** — Tests written first (red), then implementation (green), then typecheck + lint verification
8. **Continuous quality gates** — Run typecheck + lint after EVERY file change, fix all errors before proceeding

---

## Open Questions

None — design from new-integration.md is comprehensive and ready to implement.
