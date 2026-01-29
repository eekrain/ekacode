# Visuals: State Machine Diagrams

**Source:** new-integration.md (ASCII art preserved)

---

## XState Hierarchical State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│              XSTATE HIERARCHICAL STATE MACHINE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  PARENT: plan                                                        │   │
│  │  ┌────────────┐    ┌────────────┐    ┌──────────────┐             │   │
│  │  │analyze_code│───→│  research   │───→│    design     │             │   │
│  │  │(MULTI-TURN)│    │ (MULTI-TURN)│    │ (MULTI-TURN)  │             │   │
│  │  │invoke:     │    │ invoke:     │    │invoke:       │             │   │
│  │  │spawnExplore│    │runPlanAgent│    │runPlanAgent  │             │   │
│  │  │(gpt-4o-m) │    │(gpt-4o)    │    │(gpt-4o)     │             │   │
│  │  │5 iter safe │    │100 iter safe│    │100 iter safe│             │   │
│  │  │intent-based│    │intent-based│    │intent-based  │             │   │
│  │  └────────────┘    └────────────┘    │───┬───────────┘             │   │
│  │                                              ↓               │   │
│  │                                         spawnExploreAgent │   │
│  │                                         done             │   │
│  └────────────────────────────────────────┴─────────────────┘   │
│                                              ↓                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  PARENT: build                                                       │   │
│  │  ┌──────────────┐              ┌──────────────┐                      │   │
│  │  │  implement   │←─────────────→│   validate   │                      │   │
│  │  │              │              │              │                      │   │
│  │  │invoke:     │   always:     │invoke:       │                      │   │
│  │  │runBuildAgent │   check guard │runBuildAgent │                      │   │
│  │  │(claude-3.5) │   →implement  │(claude-3.5) │                      │   │
│  │  │50 iter safe │   if errors   │              │                      │   │
│  │  │intent-based│               │              │                      │   │
│  │  └──────────────┘              └──────────────┘                      │   │
│  │                                                                         │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │ doomLoopDetector: Guard checks doom loop conditions          │ │   │
│  │  │ 1. Oscillation: implement → validate (5+ times)             │ │   │
│  │  │ 2. No progress: Error count not decreasing                  │ │   │
│  │  │ 3. Time threshold: >10 minutes in build mode              │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key:** All phases use **intent-based looping** where the agent naturally stops via `finishReason === 'stop'`. The iteration limits shown are only **safety nets** for doom loop protection.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Solid.js)                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Frontend Streaming (Direct / @ai-sdk/react)                   │   │
│  │  - Real-time streaming updates via SSE                          │   │
│  │  - Tool call visualization                                      │   │
│  │  - Message history UI                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ SSE / WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      WORKFLOW (XState Machine)                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Hierarchical RLM Orchestrator                                  │   │
│  │  - State management (plan.analyze → build.implement)            │   │
│  │  - Doom loop detection (guards)                                 │   │
│  │  - Tool routing (plan-only vs build-only)                        │   │
│  │  - Message filtering & caching                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ chat() calls
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   VERCEL AI SDK (LLM Layer)                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  streamText({ model, tools, messages })                        │   │
│  │  - Provider abstraction (OpenAI/Anthropic via providers)       │   │
│  │  - Tool execution (tool() definitions)                          │   │
│  │  - Streaming (AsyncIterable<StreamPart>)                        │   │
│  │  - Type safety (Zod schemas)                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       LLM Providers                                     │
│     OpenAI (gpt-4o)     Anthropic (claude-3.5)     OpenAI (gpt-4o-mini) │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Loop Control Flow

```
Research Phase Example:
  Iteration 1: webSearch("React hooks") → finishReason='tool-calls' → CONTINUE
  Iteration 2: docsLookup("useEffect") → finishReason='tool-calls' → CONTINUE
  Iteration 3: sequentialThinking("Synthesize...") → finishReason='tool-calls' → CONTINUE
  Iteration 4: (no tools) → finishReason='stop' → STOP
  → Total: 4 iterations (agent decided when done)

With iteration limit (old approach):
  Would need to predict: 15? 20? 50?
  Too low: cut off mid-task ❌
  Too high: waste money on doom loops ❌
```

---

## Tool Access Matrix

| Tool                 | analyze_code | research | design | implement | validate | explore |
| -------------------- | ------------ | -------- | ------ | --------- | -------- | ------- |
| **Read Tools**       |
| readFile             | ✅           | ✅       | ✅     | ✅        | ✅       | ✅      |
| grep                 | ✅           | ❌       | ❌     | ❌        | ❌       | ✅      |
| glob                 | ✅           | ❌       | ❌     | ❌        | ❌       | ✅      |
| listFiles            | ✅           | ❌       | ❌     | ❌        | ❌       | ✅      |
| astParse             | ✅           | ✅       | ✅     | ✅        | ❌       | ✅      |
| **Write Tools**      |
| editFile             | ❌           | ❌       | ❌     | ✅        | ❌       | ❌      |
| generateCode         | ❌           | ❌       | ❌     | ✅        | ❌       | ❌      |
| formatCode           | ❌           | ❌       | ❌     | ✅        | ❌       | ❌      |
| **Validation Tools** |
| typescriptCheck      | ❌           | ❌       | ❌     | ❌        | ✅       | ❌      |
| eslintCheck          | ❌           | ❌       | ❌     | ❌        | ✅       | ❌      |
| lspDiagnostics       | ❌           | ❌       | ❌     | ❌        | ✅       | ❌      |
| **Research Tools**   |
| webSearch            | ❌           | ✅       | ❌     | ❌        | ✅       | ❌      |
| docsLookup           | ❌           | ✅       | ❌     | ❌        | ✅       | ❌      |
| gitLog               | ❌           | ✅       | ❌     | ❌        | ❌       | ❌      |
| **Planning Tools**   |
| sequentialThinking   | ✅           | ✅       | ✅     | ❌        | ❌       | ❌      |
| createPlan           | ❌           | ❌       | ✅     | ❌        | ❌       | ❌      |
| validatePlan         | ❌           | ❌       | ✅     | ❌        | ❌       | ❌      |
