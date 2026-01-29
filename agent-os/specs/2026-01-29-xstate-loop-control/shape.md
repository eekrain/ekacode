# Shaping Summary

**Spec:** XState Loop Control + Hierarchical Machine Design
**Date:** 2026-01-29
**Status:** Ready for Implementation

---

## Scope

**In Scope:**
- XState v5 hierarchical state machine implementation
- Intent-based loop control (primary: `finishReason === 'stop'`, backup: safety limits)
- Dynamic tool routing per phase (plan/build phases have different tool sets)
- Doom loop detection guards (oscillation, time, error progress checks)
- XState actors for Plan/Build agents
- HybridAgent integration for multimodal prompts
- Phase-specific system prompts
- Model provider setup (OpenAI, Anthropic, Z.ai)

**Out of Scope:**
- Frontend UI changes (separate effort)
- Server API changes (separate effort)
- Tool implementations (use existing registry)
- Memory/Storage integration (separate effort)

---

## Key Decisions

### 1. Intent-Based Loop Control
**Decision:** Primary completion signal is `finishReason === 'stop'`. Safety limits are backup only.

**Rationale:**
- Agents naturally stop when done via LLM intent
- Hard iteration limits cut off work mid-task
- Safety limits only trigger on doom loops (should be rare)

**Alternatives Considered:**
- Hard iteration limits → Rejected (cuts off agents mid-task)
- Time limits only → Rejected (unpredictable task duration)

### 2. Hierarchical State Structure
**Decision:** Parent states (plan/build) with child phases.

**Structure:**
```
plan/
  ├── analyze_code (spawn explore subagent)
  ├── research (multi-turn web search/docs)
  └── design (multi-turn sequential thinking)
build/
  ├── implement (write code)
  └── validate (LSP checks, recursive until clean)
```

**Rationale:**
- Clear workflow structure
- Easy to add new phases
- Doom loop detection per parent state

### 3. Dynamic Tool Routing
**Decision:** Phase-specific tool sets configured in `PHASE_TOOLS` mapping.

**Rationale:**
- Prevents agent from using wrong tools (e.g., editFile in plan mode)
- Clear separation of concerns
- Easier to debug tool usage

### 4. XState for Orchestration Only
**Decision:** XState manages state, transitions, guards. AI SDK executes LLM calls.

**Rationale:**
- Separation of concerns (state vs execution)
- XState doesn't need to handle streaming
- AI SDK has better provider abstraction

### 5. HybridAgent Integration
**Decision:** XState wraps HybridAgent for multimodal capabilities.

**Pattern:**
```typescript
// XState actor calls HybridAgent
invoke: {
  src: "runPlanAgent",
  input: ({ context }) => ({
    messages: context.messages,
    phase: "research",
  }),
}
```

**Rationale:**
- HybridAgent provides vision routing
- XState provides orchestration
- Clean separation of responsibilities

### 6. Separate State Package
**Decision:** State logic in `packages/core/src/state/`.

**Structure:**
```
packages/core/src/state/
├── types.ts           # State machine types
├── machine.ts         # XState machine definition
├── loop-control.ts    # Intent-based loop control
├── actors/            # XState actors
├── tools/             # Tool routing
├── guards/            # Doom loop detection
├── integration/       # HybridAgent integration
└── prompts/           # Phase-specific prompts
```

**Rationale:**
- Clear separation from agent logic
- Easy to test independently
- Follows monorepo patterns

### 7. TDD Approach
**Decision:** Tests written first (red), then implementation (green), then typecheck + lint.

**Workflow:**
1. Create test file (should fail)
2. Create source file (make test pass)
3. Run typecheck + lint (must pass)
4. Move to next file

**Rationale:**
- Ensures test coverage
- Catches errors early
- Enforces quality standards

---

## Context

### Problem Statement
Current agent system lacks:
1. Deterministic loop control (agents don't know when to stop)
2. State-dependent tool routing (agents can use any tool anytime)
3. Doom loop detection (infinite fix loops possible)

### Solution
XState v5 hierarchical state machine provides:
1. Intent-based loop control via `finishReason` checking
2. Phase-specific tool routing
3. Doom loop guards (oscillation, time, error progress)

### Integration Points
- **HybridAgent:** Multimodal prompt routing
- **Plan/Build Actors:** XState wraps existing agents
- **Tool Registry:** Existing tools wrapped for phase routing
- **Model Provider:** Z.ai provider integration

---

## Constraints

### Technical Constraints
- Must use XState v5 (latest version)
- Must use Vercel AI SDK v6 for LLM calls
- Must use existing tool registry
- Must pass typecheck + lint after every change

### Quality Constraints
- Zero TypeScript errors
- Zero ESLint errors
- All tests in `tests/` directory
- Test coverage for all new code

### Time Constraints
- Implement in order (Tasks 1-10)
- Don't skip TDD workflow
- Fix errors before proceeding

---

## Success Criteria

1. **Functional:**
   - XState machine creates without errors
   - State transitions work correctly
   - Loop control stops at `finishReason === 'stop'`
   - Tool filtering works per phase
   - Doom detection triggers appropriately

2. **Quality:**
   - Zero TypeScript errors
   - Zero ESLint errors
   - All tests pass
   - Tests in `tests/` directory

3. **Integration:**
   - HybridAgent integrates correctly
   - Plan/Build actors work with XState
   - Dynamic tool routing prevents wrong tools

---

## Open Questions

None — design is comprehensive and ready to implement.
