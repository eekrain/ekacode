# References

**Spec:** XState Loop Control + Hierarchical Machine Design
**Date:** 2026-01-29

---

## Primary Reference

### new-integration.md
**Path:** `.claude/research/plans/new-integration.md`

**Complete XState integration design covering:**

**Lines 167-315: Agent Loop Strategies**
- Intent-based looping via `finishReason === 'stop'`
- Safety limits as backup only
- `checkLoopControl()` function implementation
- `PHASE_SAFETY_LIMITS` constants
- `executeMultiTurnAgent()` wrapper

**Lines 402-707: XState v5 State Machine Design**
- Hierarchical state types (`AgentMode`, `PlanPhase`, `BuildPhase`)
- `RLMMachineContext` interface
- `RLMMachineEvent` union type
- Complete `rlmMachine` implementation
- State transition diagram (ASCII)

**Lines 711-834: Vercel AI SDK Integration**
- LLM provider setup (OpenAI, Anthropic)
- XState actor implementations
- `executeAgent()` helper function
- `spawnExploreAgent`, `runPlanAgent`, `runBuildAgent` actors

**Lines 1070-1187: Tool System**
- `PHASE_TOOLS` configuration
- `getPlanTools()` function
- `getBuildTools()` function
- Tool access matrix

**Lines 1328-1464: Doom Loop Detection**
- `doomLoopGuard` implementation
- `hasValidationErrors` guard
- `isBuildClean` guard
- `countBuildOscillations()` helper

**Lines 1250-1324: Agent Configuration**
- `PLAN_PHASE_NOTICES` prompts
- `BUILD_PHASE_NOTICES` prompts
- Phase-specific system prompts

---

## Supporting References

### tech-stack.md
**Path:** `agent-os/standards/global/tech-stack.md`

**Lines 95-98: XState**
- Rationale for XState v5
- Integration with HybridAgent

**Lines 42-46: Vercel AI SDK v6**
- UIMessage stream protocol
- `streamText` pipeline

### code-quality.md
**Path:** `agent-os/standards/global/code-quality.md`

**Lines 1-10: Error Resolution**
- Zero tolerance for TypeScript/ESLint errors
- Pre-commit workflow

**Lines 153-159: Test Layout**
- Tests in `packages/*/tests` directory

---

## Existing Code References

### packages/core/src/agents/
**Purpose:** Existing agent patterns for integration context

- `hybrid-agent/` — HybridAgent implementation (vision routing)
- `planner.ts` — Plan agent (to be wrapped by XState)
- `coder.ts` — Build agent (to be wrapped by XState)

### packages/core/src/tools/
**Purpose:** Tool registry for phase routing

- `registry.ts` — Tool registry
- Individual tool files — Tool definitions

### packages/zai/src/
**Purpose:** Z.ai provider integration

- `zai-provider.ts` — Provider factory

---

## External Documentation

### XState v5 Documentation
**URL:** https://stately.ai/docs

**Key Concepts:**
- `createMachine()` — Define state machines
- `createActor()` — Spawn running instances
- `setup()` — Machine configuration
- `fromPromise()` — Create actors from async functions

### Vercel AI SDK Documentation
**URL:** https://sdk.vercel.ai/docs

**Key Concepts:**
- `streamText()` — Main streaming function
- `tool()` — Type-safe tool definitions
- Providers — `openai()`, `anthropic()`
- `finishReason` — Loop control signal

---

## Implementation Order

**Follow this order:**
1. Task 1: Spec documentation (current task)
2. Task 2: Install XState dependency
3. Task 3: Machine structure (types, machine, loop-control)
4. Task 4: Actors (explore, plan, build)
5. Task 5: Tool routing (tool-filter, phase-tools)
6. Task 6: Doom loop guards
7. Task 7: HybridAgent integration
8. Task 8: Phase prompts
9. Task 9: Test verification
10. Task 10: Typecheck + lint

**TDD Workflow:**
1. Create test file (red)
2. Create source file (green)
3. Run typecheck + lint
4. Move to next file
