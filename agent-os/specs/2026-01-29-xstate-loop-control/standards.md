# Applied Standards

**Spec:** XState Loop Control + Hierarchical Machine Design
**Date:** 2026-01-29

---

## Tech Stack Standard

### XState v5 (Agent Orchestration)
**Source:** `agent-os/standards/global/tech-stack.md` lines 95-98

**Standard:**
```
### XState (Agent Orchestration)

- **Version**: Latest
- **Rationale**: Primary Plan/Build orchestration; deterministic loops, explicit phases, and tool routing; integrates with HybridAgent for multimodal prompts.
```

**Application:**
- Using XState v5 (^5.18.0) for hierarchical state machine
- Orchestration only (LLM calls via AI SDK)
- Deterministic loop control via `finishReason` checking
- Explicit phases: analyze → research → design → implement → validate

### Vercel AI SDK v6 (LLM Layer)
**Source:** `agent-os/standards/global/tech-stack.md` lines 42-46

**Standard:**
```
### Vercel AI SDK v6 (Headless Chat + Streaming Consumer)

- **Version**: ^6.x
- **Rationale**: UIMessage stream protocol, `streamText` pipeline, tool streaming, custom `data-*` parts; used with Solid renderer and Hono server.
```

**Application:**
- Using AI SDK for all LLM calls (`streamText()`)
- Provider abstraction via `@ai-sdk/openai`, `@ai-sdk/anthropic`
- Tool execution via `tool()` definitions
- Streaming output for real-time updates

---

## Code Quality Standard

### TypeScript and ESLint Error Resolution
**Source:** `agent-os/standards/global/code-quality.md` lines 1-10

**Standard:**
```
## TypeScript and ESLint Error Resolution

### Rule

**ALL TypeScript and ESLint errors MUST be fixed before committing code.**

No exceptions. Zero tolerance policy.
```

**Application:**
- Run `typecheck` after every file change
- Run `lint` after every file change
- Fix all errors before proceeding to next task
- No `any` types, no unused variables

### Test Layout
**Source:** `agent-os/standards/global/code-quality.md` lines 153-159

**Standard:**
```
### Rule

**All test files live under `packages/*/tests`**, not alongside source files.
```

**Application:**
- All test files in `packages/core/tests/state/`
- Test files mirror source structure
- Source files in `packages/core/src/state/`

### TDD Workflow
**Application of Standard:**
1. Create test file first (red → should fail)
2. Create source file (green → make test pass)
3. Run typecheck + lint (must pass)
4. Move to next file

**Verification Commands:**
```bash
# After EACH file change
pnpm --filter @ekacode/core typecheck
pnpm --filter @ekacode/core lint

# Before completing spec
pnpm --filter @ekacode/core test
```

---

## Implementation Standards

### File Naming
**Convention:** kebab-case for all files

**Examples:**
- `loop-control.ts` (not `loopControl.ts`)
- `doom-loop.ts` (not `doomLoop.ts`)
- `tool-filter.ts` (not `toolFilter.ts`)

### Directory Structure
**Convention:** Logical grouping by feature

```
packages/core/src/state/
├── types.ts              # Type definitions
├── machine.ts            # XState machine
├── loop-control.ts       # Loop control logic
├── actors/               # XState actors
│   ├── explore-agent.ts
│   ├── plan-agent.ts
│   └── build-agent.ts
├── tools/                # Tool routing
│   ├── tool-filter.ts
│   └── phase-tools.ts
├── guards/               # Doom loop detection
│   └── doom-loop.ts
├── integration/          # HybridAgent integration
│   ├── hybrid-agent.ts
│   └── model-provider.ts
└── prompts/              # Phase-specific prompts
    ├── plan-prompts.ts
    └── build-prompts.ts
```

### TypeScript Patterns
**Required:**
- Explicit return types on all functions
- No `any` types (use `unknown` with type guards)
- Interface exports for all public types
- Strict null checks

**Example:**
```typescript
// ✅ GOOD
export function checkLoopControl(params: {
  iterationCount: number;
  finishReason: string | null | undefined;
  safetyLimit: number;
  phaseName: string;
}): LoopControlResult {
  // ...
}

// ❌ BAD
export function checkLoopControl(params: any) {
  // ...
}
```

### XState Patterns
**Required:**
- Use `setup()` for machine configuration (XState v5 pattern)
- Use `fromPromise()` for actors
- Type context and events properly
- Export actors for testing

**Example:**
```typescript
// ✅ GOOD
export const rlmMachine = setup({
  types: {
    context: {} as RLMMachineContext,
    events: {} as RLMMachineEvent,
  },
  actors: {
    spawnExploreAgent: fromPromise(async ({ input }) => {
      // ...
    }),
  },
}).createMachine({
  // ...
});
```

---

## Quality Gates

### Pre-Commit Checklist
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings
- [ ] All tests pass
- [ ] No `any` types
- [ ] No unused variables
- [ ] No `require()` style imports

### Pre-Merge Checklist
- [ ] All tasks completed (1-10)
- [ ] All tests pass
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Documentation updated

---

## Summary

**Standards Applied:**
1. **XState v5** — Agent orchestration
2. **Vercel AI SDK v6** — LLM abstraction layer
3. **Zero Errors** — TypeScript and ESLint must pass
4. **Test Layout** — Tests in `tests/` directory
5. **TDD Workflow** — Tests first, then implementation
6. **File Naming** — kebab-case convention
7. **TypeScript Patterns** — Explicit types, no `any`
8. **XState Patterns** — Use `setup()` and `fromPromise()`

**Verification Commands:**
```bash
# After each file
pnpm --filter @ekacode/core typecheck
pnpm --filter @ekacode/core lint

# Final verification
pnpm --filter @ekacode/core test
```
