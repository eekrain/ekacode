# Coding Agent Implementation Plan: Hierarchical 2-Agent RLM Architecture

> A comprehensive architecture guide for building an autonomous coding agent using Recursive Language Models (RLM) with a hierarchical 2-agent system (Plan + Build), state-dependent tool routing, and prompt-caching optimization.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Framework Comparison: Mastra vs OpenCode](#framework-comparison)
3. [Why Custom Engine for RLM](#why-custom-engine-for-rlm)
4. [RLM Pattern Explained](#rlm-pattern-explained)
5. [Architecture: Hierarchical 2-Agent System](#architecture-hierarchical-2-agent-system)
6. [Hierarchical State Machine Design](#hierarchical-state-machine-design)
7. [Tool Access by Capability](#tool-access-by-capability)
8. [Agent Configurations](#agent-configurations)
9. [Complete Implementation](#complete-implementation)
10. [Tool Access Patterns and Prompt Caching](#tool-access-patterns-and-prompt-caching)
11. [Doom Loop Detection](#doom-loop-detection)
12. [Testing Strategy](#testing-strategy)
13. [Deployment Considerations](#deployment-considerations)

---

## Executive Summary

### The Problem

Building a coding agent requires:

- **Clear separation of concerns** - Strategic planning vs tactical execution
- **Cost optimization** - Use cheaper models where appropriate
- **State-dependent capabilities** - Read-only for planning, write-only for building
- **Recursive validation** - Self-healing loops with LSP checks
- **Doom loop prevention** - Avoid infinite fix cycles

### The Solution

**Hierarchical 2-Agent RLM System** provides:

- ✅ **Plan Agent**: Read-only strategic planning with 3 phases (analyze_code → research → design)
- ✅ **Build Agent**: Write-only execution with recursive validation (implement ⇄ validate)
- ✅ **Selective subagent spawning**: Only analyze_code spawns "explore" subagent (cheaper model)
- ✅ **Task management**: Build agent tracks progress with TodoWrite/Read
- ✅ **Emergency research**: Build agent has limited research tools for error documentation
- ✅ **Doom loop detection**: OpenCode-style pattern detection
- ✅ **Prompt caching**: ~95% cache hit rate with transition-aware steering

### The Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    TECHNOLOGY STACK                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Core:          Custom RLM Engine (TypeScript)              │
│  Architecture:  Hierarchical 2-Agent (Plan + Build)         │
│  State Mgmt:    XState v5 (Finite State Machine)            │
│  LLM:           GPT-4o (plan) / Claude 3.5 Sonnet (build)   │
│  Subagent:      GPT-4o-mini (explore)                       │
│  Tools:         MCP servers (filesystem, github, LSP)       │
│  Orchestration:  Mastra (optional - for persistence)        │
│  AST Parsing:   ts-morph / LSP integration                  │
│  Memory:        Vector DB (semantic search)                 │
│  Storage:       PostgreSQL (state persistence)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Framework Comparison: Mastra vs OpenCode

### Mastra Workflows

**Location:** `/mastra/packages/core/src/workflows`

**Architecture:**

- **30+ files**, ~4000+ lines of code
- Dual engines: DefaultExecutionEngine (in-memory) + EventedExecutionEngine (PubSub)
- Step-based: `.then()`, `.parallel()`, `.branch()`, `.loop()`, `.foreach()`
- Pre-compiled step graph defined at workflow creation

**Key Features:**
| Feature | Description |
|---------|-------------|
| Suspend/Resume | Steps can pause execution and resume later |
| Time Travel | Restart from any historical step |
| Nested Workflows | Workflows can contain other workflows |
| Type Safety | Full TypeScript inference from Zod schemas |
| Deterministic | Step graph is validated upfront |
| Observability | Native OpenTelemetry span integration |
| Retry Logic | Per-step retry with configurable delay |

**Strengths for Coding Agents:**

1. Multi-step workflow orchestration (Plan → Code → Test → Debug)
2. Parallel execution (run tests, linters, type checks concurrently)
3. Suspend/resume for interactive approval
4. Storage persistence for long-running sessions
5. Tool system integration
6. Memory system for context
7. Tripwire validation for bad patterns

**Weaknesses for RLM:**

1. **Static step graph** - compiled upfront, can't restructure dynamically
2. **Rigid structure** - must know all possible paths before execution
3. **No native permissions** - agents can access any tool
4. **No doom loop detection** - agents can get stuck in retry cycles
5. **Complex API** - verbose, requires schema definitions for everything

### OpenCode Agent Orchestration

**Location:** `/opencode/packages/opencode/src`

**Architecture:**

- **Session-based** - continuous LLM loop with tool calling
- Agent-driven control flow
- Message-based state management

**Key Features:**
| Feature | Description |
|---------|-------------|
| Agent Switching | Change agents mid-session via tools |
| Permission System | Per-agent fine-grained permissions |
| Doom Loop Detection | Detects repetitive tool call patterns |
| Message Compaction | Handles long conversations efficiently |
| File Snapshots | Tracks changes during execution |
| Subagent Delegation | Task tool spawns isolated sessions |
| Simpler Model | ~1500 lines vs Mastra's 4000+ |

**Strengths for RLM:**

1. **LLM-native** - tool calling is the primary control flow
2. **Dynamic** - LLM decides what to do next at each iteration
3. **Flexible** - no pre-defined structure
4. **Simpler** - less boilerplate, easier to understand
5. **Permission system** - built-in safety for file operations

**Weaknesses for Structured Workflows:**

1. No explicit control flow primitives (no .loop(), .parallel())
2. Less deterministic - relies on LLM to call tools correctly
3. Weaker type safety at workflow level
4. No built-in suspend/resume primitives (only session-level)

### Capability Matrix

| Capability            | Mastra                     | OpenCode              |
| --------------------- | -------------------------- | --------------------- |
| Sequential execution  | ✅                         | ✅ (via LLM)          |
| Parallel execution    | ✅ `.parallel()`           | ❌                    |
| Conditional branching | ✅ `.branch()`             | ✅ (via LLM)          |
| Loops                 | ✅ `.loop()`, `.foreach()` | ❌                    |
| Suspend/Resume        | ✅ Step-level              | ⚠️ Session-level only |
| Time travel           | ✅                         | ❌                    |
| Nested workflows      | ✅                         | ❌                    |
| Type safety           | ✅ Full inference          | ⚠️ Tool-level only    |
| Deterministic         | ✅                         | ❌                    |
| LLM-driven            | ⚠️ Per step                | ✅ Primary            |
| Simple API            | ❌                         | ✅                    |
| Low complexity        | ❌                         | ✅                    |
| Permissions           | ❌                         | ✅ Per-agent          |
| Doom loop detection   | ❌                         | ✅                    |
| Message compaction    | ❌                         | ✅                    |
| File snapshots        | ⚠️ Via storage             | ✅ Native             |
| State-dependent tools | ❌                         | ✅ Natural fit        |

---

## Why Custom Engine for RLM

### The Fundamental Mismatch

**Mastra's Philosophy: Pre-Compiled Step Graph**

```typescript
// Mastra: Graph is FIXED at compile time
const workflow = createWorkflow({ id: "rlm" })
  .then(planStep)
  .then(executeStep)
  .then(reflectStep)
  .dountil(successCondition)
  .commit();
```

This works for predictable workflows but breaks down for RLM because:

- Step structure is defined upfront
- Loops repeat the SAME sequence each iteration
- Branches are pre-defined, not dynamically discovered
- Can't spawn new branches or restructure dynamically

**RLM Requires: Dynamic Reflective Loop**

```
1. GENERATE PLAN    "Here's what I'll do..."
2. EXECUTE STEP    "Running tool X..."
3. OBSERVE RESULT "Tool returned Y..."
4. REFLECT         "Result unexpected. New plan:..."
5. DECIDE          "Continue with step Z" or "re-plan"

← Loop back to 2, or regenerate plan at 1
```

At step 4, the agent might decide to **completely change approach** - this requires dynamic tool availability and state transitions that Mastra's static graph cannot handle.

### What You Want: Hierarchical Agent System

```typescript
// Dynamic tool availability based on agent mode
const AGENT_TOOLS = {
  // Plan Agent - Read-Only (Always)
  plan: {
    tools: [grep, glob, readFile, astParse, sequentialThinking, createPlan],
    description: "Understand, research, and plan",
    canEdit: false, // Never writes files
  },

  // Build Agent - Write-Only + Emergency Research
  build: {
    tools: [editFile, generateCode, typescriptCheck, eslintCheck, webSearch],
    description: "Execute and validate with emergency research",
    canEdit: true, // Writes files
  },
};
```

### Why Mastra is Cumbersome for This

| Requirement                 | Mastra Approach                | Problem                  |
| --------------------------- | ------------------------------ | ------------------------ |
| Hierarchical agents         | Create separate Agent per mode | Complex orchestration    |
| Selective subagent spawning | Manual workflow coordination   | No native support        |
| Mode-based tools            | Don't include in Agent.tools   | Can't dynamically switch |
| Read-only enforcement       | Permissions system             | Permissions ≠ capability |
| Doom loop detection         | Custom implementation          | No native support        |

---

## RLM Pattern Explained

### Recursive Language Models (RLM)

RLM is a pattern where the model:

1. Generates a plan
2. Executes steps from the plan
3. Observes results
4. Reflects on what happened
5. Decides whether to continue, revise the plan, or complete
6. Repeats the cycle until satisfied

### The RLM Loop Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    RLM Core Loop                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. GENERATE PLAN    "Here's what I'll do..."              │
│     ↓                                                      │
│  2. EXECUTE STEP    "Running tool X..."                   │
│     ↓                                                      │
│  3. OBSERVE RESULT "Tool returned Y..."                   │
│     ↓                                                      │
│  4. REFLECT         "Result unexpected. New plan:..."     │
│     ↓                                                      │
│  5. DECIDE          "Continue with step Z" or "re-plan"    │
│     ↓                                                      │
│  (Loop back to 2, or regenerate plan at 1)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key RLM Characteristics

1. **Dynamic Planning**: Plan can be revised at any iteration
2. **Reflective Adaptation**: Agent observes results and changes approach
3. **Iterative Execution**: Try → Observe → Reflect → Adjust cycle
4. **Self-Healing**: Automatically retry failed steps with different approach
5. **State-Aware**: Different phases require different capabilities

---

## Architecture: Hierarchical 2-Agent System

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│           HIERARCHICAL 2-AGENT RLM ARCHITECTURE             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PARENT: PLAN AGENT (Read-Only)                    │   │
│  │  Model: GPT-4o                                      │   │
│  │  Tools: Always read-only                           │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Child States:                                     │   │
│  │  1. analyze_code → SPAWN "explore" subagent        │   │
│  │     Model: GPT-4o-mini (cheaper)                   │   │
│  │     Tools: grep, glob, readFile, astParse          │   │
│  │                                                     │   │
│  │  2. research → Runs in plan agent                  │   │
│  │     Tools: webSearch, docsLookup, sequentialThinking│   │
│  │                                                     │   │
│  │  3. design → Runs in plan agent                    │   │
│  │     Tools: sequentialThinking, createPlan          │   │
│  │     Output: Structured plan → Build agent          │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↓ Handoff                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PARENT: BUILD AGENT (Write-Only + Emergency)       │   │
│  │  Model: Claude 3.5 Sonnet                           │   │
│  │  Tools: Write tools + LSP + emergency research     │   │
│  │  Task Management: TodoWrite, TodoRead, TaskList    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Child States (Recursive):                         │   │
│  │  1. implement                                      │   │
│  │     Tools: editFile, generateCode, formatCode      │   │
│  │     Task mgmt: TodoWrite, TodoRead, TaskGet        │   │
│  │                                                     │   │
│  │  2. validate                                       │   │
│  │     Tools: typescriptCheck, eslintCheck, lspDiagnostics│   │
│  │     Emergency: webSearch, docsLookup (for errors)  │   │
│  │                                                     │   │
│  │  Recursive Loop: implement ⇄ validate              │   │
│  │  └─ Doom loop detection (OpenCode pattern)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Agent Handoff Flow

```
User Request
     ↓
┌─────────────────┐
│  PLAN AGENT     │
├─────────────────┤
│ 1. explore()    │ ← Spawn subagent (gpt-4o-mini)
│    ↓            │
│ 2. research()   │ ← Plan agent (gpt-4o)
│    ↓            │
│ 3. design()     │ ← Plan agent (gpt-4o)
│    ↓            │
│ Output: Plan    │
└─────────────────┘
     ↓ Handoff
┌─────────────────┐
│  BUILD AGENT    │
├─────────────────┤
│ while (!clean)  │
│ 1. implement()  │ ← Build agent (claude-3.5-sonnet)
│    ↓            │
│ 2. validate()   │ ← Build agent (same)
│    ↓            │
│ if errors       │
│    → implement()│ (recursive)
└─────────────────┘
     ↓
  Success!
```

### Why This Architecture Works

**Plan Agent (Strategic)**:

- ✅ Read-only = 100% safe exploration
- ✅ Cheaper model for exploration (gpt-4o-mini)
- ✅ Sequential thinking for research/design
- ✅ Cannot accidentally break anything

**Build Agent (Tactical)**:

- ✅ Write access for implementation
- ✅ Task management for tracking progress
- ✅ Emergency research when stuck
- ✅ Recursive self-healing via LSP validation
- ✅ Doom loop protection

---

## Hierarchical State Machine Design

### State Type Definitions

```typescript
// ============================================================================
// TYPES
// ============================================================================

// Parent agent modes
type AgentMode = "plan" | "build";

// Plan agent child phases (linear)
type PlanPhase = "analyze_code" | "research" | "design";

// Build agent child phases (recursive)
type BuildPhase = "implement" | "validate";

// Combined hierarchical state
type HierarchicalState =
  | { mode: "plan"; phase: PlanPhase }
  | { mode: "build"; phase: BuildPhase }
  | "done"
  | "failed";
```

### State Transition Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│              HIERARCHICAL STATE MACHINE TRANSITIONS                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PLAN AGENT (Linear Progression)                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │ analyze_code │───→│  research    │───→│    design    │             │
│  │              │    │              │    │              │             │
│  │ Spawn:       │    │ In: Plan     │    │ In: Plan     │             │
│  │ explore sub  │    │ agent        │    │ agent        │             │
│  │ (gpt-4o-mini)│    │ (gpt-4o)     │    │ (gpt-4o)     │             │
│  └──────────────┘    └──────────────┘    └──────┬───────┘             │
│                                              ↓                       │
│                                         Handoff to Build              │
│                                              ↓                       │
│  BUILD AGENT (Recursive Loop)                                          │
│  ┌──────────────┐              ┌──────────────┐                      │
│  │  implement   │←─────────────→│   validate   │                      │
│  │              │              │              │                      │
│  │ Edit files   │   Recursive   │ LSP checks   │                      │
│  │ TodoWrite    │   on errors   │ Emergency    │                      │
│  └──────────────┘              │ research     │                      │
│                                └──────────────┘                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Valid State Transitions

```typescript
const VALID_TRANSITIONS = {
  // Plan agent (linear - always forward)
  plan: {
    analyze_code: "research",
    research: "design",
    design: "build", // Handoff to build agent
  },

  // Build agent (recursive - can oscillate)
  build: {
    implement: "validate",
    validate: "implement", // Back to implement on errors
  },
};
```

### Transition Rules

**Plan Agent (Linear)**:

```typescript
analyze_code → research → design → build
```

**Build Agent (Recursive)**:

```typescript
implement → validate
validate → implement (if errors)
validate → done (if clean)
```

---

## Tool Access by Capability

### Key Principle: Capability-Based Separation

**Plan Agent**: ALWAYS read-only tools
**Build Agent**: ALWAYS write tools + emergency research

### Tool Configuration

```typescript
const AGENT_TOOLS = {
  // ========================================================================
  // PLAN AGENT: Read-Only (Always)
  // ========================================================================

  plan: {
    // Available to ALL plan phases
    enable: [
      // File system (read-only)
      "readFile",
      "listFiles",
      "grep",
      "glob",

      // AST (read-only)
      "astParse",
      "getSymbol",

      // Research (read-only)
      "webSearch",
      "docsLookup",
      "gitLog",
      "memorySearch",

      // Planning (read-only output)
      "sequentialThinking",
      "createPlan",
      "validatePlan",
    ],

    // NEVER available to plan agent
    disable: [
      // NO WRITE TOOLS
      "editFile",
      "generateCode",
      "formatCode",

      // NO EXECUTION TOOLS
      "runTests",
      "typescriptCheck",
      "eslintCheck",
      "lspDiagnostics",

      // NO TASK MANAGEMENT
      "TodoWrite",
      "TodoRead",
      "TaskGet",
      "TaskList",
    ],
  },

  // ========================================================================
  // BUILD AGENT: Write-Only + Emergency Research
  // ========================================================================

  build: {
    enable: [
      // Write tools
      "editFile",
      "generateCode",
      "formatCode",
      "astParse",

      // Validation
      "typescriptCheck", // tsc --noEmit
      "eslintCheck", // eslint
      "lspDiagnostics", // LSP diagnostics

      // Task management
      "TodoWrite",
      "TodoRead",
      "TaskGet",
      "TaskList",

      // EMERGENCY RESEARCH (limited)
      "webSearch", // For error documentation
      "docsLookup", // For API references
      "readFile", // To reference code
    ],

    disable: [
      // NO STRATEGIC TOOLS
      "sequentialThinking", // No deep reflection during coding
      "createPlan", // No replanning
      "validatePlan", // No plan validation

      // NO EXPLORATION
      "listFiles", // Minimal file operations
      "grep", // Only read what's needed
      "gitLog", // No history exploration
      "memorySearch", // No semantic search
    ],
  },
};
```

### Tool Availability Matrix

| Tool                 | Plan Agent | Build Agent  | Purpose                |
| -------------------- | ---------- | ------------ | ---------------------- |
| **Read Tools**       |
| readFile             | ✅         | ✅           | Reference code         |
| listFiles            | ✅         | ❌           | Explore structure      |
| grep                 | ✅         | ❌           | Search code            |
| glob                 | ✅         | ❌           | Find files             |
| astParse             | ✅         | ✅           | Parse AST              |
| getSymbol            | ✅         | ❌           | Get symbols            |
| **Research Tools**   |
| webSearch            | ✅         | ⚠️ Emergency | Find info / error docs |
| docsLookup           | ✅         | ⚠️ Emergency | Read docs / API ref    |
| gitLog               | ✅         | ❌           | Git history            |
| memorySearch         | ✅         | ❌           | Semantic search        |
| **Planning Tools**   |
| sequentialThinking   | ✅         | ❌           | Deep reasoning         |
| createPlan           | ✅         | ❌           | Create plan            |
| validatePlan         | ✅         | ❌           | Validate plan          |
| **Write Tools**      |
| editFile             | ❌         | ✅           | Edit files             |
| generateCode         | ❌         | ✅           | Generate code          |
| formatCode           | ❌         | ✅           | Format code            |
| **Validation Tools** |
| typescriptCheck      | ❌         | ✅           | TS validation          |
| eslintCheck          | ❌         | ✅           | ESLint validation      |
| lspDiagnostics       | ❌         | ✅           | LSP diagnostics        |
| **Task Management**  |
| TodoWrite            | ❌         | ✅           | Create tasks           |
| TodoRead             | ❌         | ✅           | Read tasks             |
| TaskGet              | ❌         | ✅           | Get task               |
| TaskList             | ❌         | ✅           | List tasks             |

---

## Agent Configurations

### Agent Model Selection

```typescript
// ============================================================================
// AGENT CONFIGURATIONS
// ============================================================================

interface AgentConfig {
  model: string;
  tools: string[];
  systemPrompt: string;
  temperature?: number;
}

const AGENT_CONFIGS: Record<AgentMode, AgentConfig> = {
  plan: {
    model: "gpt-4o", // Main model for reasoning
    temperature: 0.7,
    tools: AGENT_TOOLS.plan.enable,
    systemPrompt: `You are the PLAN agent.

CAPABILITIES: Read-only access to understand the codebase.
PHASES: analyze_code → research → design

PHASE DETAILS:
1. analyze_code: Spawn EXPLORE subagent (gpt-4o-mini) to understand structure
2. research: Research best practices, patterns, documentation
3. design: Create detailed implementation plan

You have READ-ONLY access. You cannot modify any files.
Your output is a structured plan for the BUILD agent.`,
  },

  build: {
    model: "claude-3-5-sonnet-20241022", // Best for code editing
    temperature: 0.3, // Lower temp for more deterministic output
    tools: AGENT_TOOLS.build.enable,
    systemPrompt: `You are the BUILD agent.

CAPABILITIES: Write access to implement the plan with LSP validation.
PHASES: implement ⇄ validate (recursive until clean)

PHASE DETAILS:
1. implement: Execute plan, track progress with TodoWrite
2. validate: Run LSP checks (TypeScript, ESLint)

EMERGENCY RESEARCH:
If you encounter errors you cannot fix from context:
- Use webSearch for error documentation
- Use docsLookup for API references
- Apply fix from documentation

RECURSIVE LOOP:
After implementing, always validate.
If validation finds errors → fix → validate again.
Continue until LSP checks pass.

TASK MANAGEMENT:
Use TodoWrite to track your progress.
Use TaskList to see remaining tasks.`,
  },
};

// ============================================================================
// SUBAGENT CONFIGURATIONS
// ============================================================================

const SUBAGENT_CONFIGS = {
  explore: {
    model: "gpt-4o-mini", // Cheaper model for exploration
    temperature: 0.3,
    tools: ["grep", "glob", "readFile", "listFiles", "astParse", "getSymbol"],
    systemPrompt: `You are the EXPLORE subagent.
SPAWNED BY: Plan agent during analyze_code phase

Your job: Understand codebase structure and patterns.
Focus: Read and analyze only.

TOOLS:
- grep: Search code with regex
- glob: Find files by pattern
- readFile: Read file contents
- listFiles: List directory contents
- astParse: Parse TypeScript AST
- getSymbol: Get symbol from AST

CONSTRAINTS:
- You CAN ONLY READ. You cannot edit, write, or modify anything.
- Focus on understanding: file structure, patterns, dependencies.
- Report findings back to plan agent.

Output: Summary of codebase structure and relevant patterns.`,
  },
};
```

### Tool Registry

```typescript
// ============================================================================
// TOOL REGISTRY
// ============================================================================

interface ToolRegistry {
  [name: string]: () => Tool;
}

const TOOL_REGISTRY: ToolRegistry = {
  // Read tools
  readFile: () => createReadFileTool(),
  listFiles: () => createListFilesTool(),
  grep: () => createGrepTool(),
  glob: () => createGlobTool(),
  astParse: () => createASTParseTool(),
  getSymbol: () => createGetSymbolTool(),

  // Research tools
  webSearch: () => createWebSearchTool(),
  docsLookup: () => createDocsLookupTool(),
  gitLog: () => createGitLogTool(),
  memorySearch: () => createMemorySearchTool(),

  // Planning tools
  sequentialThinking: () => createSequentialThinkingTool(),
  createPlan: () => createPlanTool(),
  validatePlan: () => createValidatePlanTool(),

  // Write tools
  editFile: () => createEditFileTool(),
  generateCode: () => createGenerateTool(),
  formatCode: () => createFormatTool(),

  // Validation tools
  typescriptCheck: () => createTypeScriptCheckTool(),
  eslintCheck: () => createESLintCheckTool(),
  lspDiagnostics: () => createLSPDiagnosticsTool(),

  // Task management
  TodoWrite: () => createTodoWriteTool(),
  TodoRead: () => createTodoReadTool(),
  TaskGet: () => createTaskGetTool(),
  TaskList: () => createTaskListTool(),
};
```

---

## Complete Implementation

### Hierarchical RLM Engine

```typescript
// ============================================================================
// HIERARCHICAL RLM ENGINE
// ============================================================================

export class HierarchicalRLMEngine {
  private currentState: HierarchicalState = { mode: "plan", phase: "analyze_code" };
  private context: Message[] = [];
  private doomLoopDetector: DoomLoopDetector;

  constructor(
    private llm: LLMService,
    private goal: string
  ) {
    this.doomLoopDetector = new DoomLoopDetector();
  }

  async execute(): Promise<RLMResult> {
    this.context.push({ role: "user", content: this.goal });

    // ========================================================================
    // PHASE 1: PLAN AGENT (Linear Progression)
    // ========================================================================

    while (this.currentState.mode === "plan") {
      await this.runPlanPhase();

      // Check if we should transition to build
      if (this.currentState.phase === "design" && this.isPlanComplete()) {
        this.transitionToBuildAgent();
      }
    }

    // ========================================================================
    // PHASE 2: BUILD AGENT (Recursive Loop)
    // ========================================================================

    while (this.currentState.mode === "build") {
      await this.runBuildPhase();

      // Check for doom loop
      if (this.doomLoopDetector.check(this.currentState)) {
        throw new Error("Build agent stuck in doom loop");
      }

      // Check if done
      if (this.isBuildComplete()) {
        this.currentState = "done";
        break;
      }
    }

    return this.buildResult();
  }

  // ==========================================================================
  // PLAN AGENT METHODS
  // ==========================================================================

  private async runPlanPhase(): Promise<void> {
    const phase = this.currentState.phase;
    const config = PLAN_PHASE_CONFIG[phase];

    // Check if we should spawn subagent
    if (config.spawnSubagent) {
      await this.spawnExploreAgent();
      this.transitionToPlanPhase("research");
    } else {
      // Run in plan agent
      await this.runInPlanAgent(phase);
      this.transitionToPlanPhase(this.getNextPlanPhase(phase));
    }
  }

  private async spawnExploreAgent(): Promise<void> {
    console.log("🔍 Spawning EXPLORE subagent (gpt-4o-mini)...");

    const exploreAgent = new Agent(SUBAGENT_CONFIGS.explore);
    const result = await exploreAgent.generate({
      messages: this.context,
      tools: this.getToolsForSubagent("explore"),
    });

    // Merge results back into plan agent context
    this.context.push({
      role: "system",
      content: `## EXPLORE SUBAGENT FINDINGS\n\n${result.content}`,
    });

    console.log("✅ Explore subagent completed");
  }

  private async runInPlanAgent(phase: PlanPhase): Promise<void> {
    const planAgent = new Agent(AGENT_CONFIGS.plan);

    const decision = await planAgent.generate({
      messages: this.buildMessages(),
      tools: this.getToolsForAgent("plan"),
      system: this.buildTransitionNotice({ mode: "plan", phase }),
    });

    this.context.push({ role: "assistant", content: decision.content });
  }

  private transitionToPlanPhase(nextPhase: PlanPhase): void {
    this.currentState = { mode: "plan", phase: nextPhase };
    console.log(`📋 Plan agent: ${nextPhase} phase`);
  }

  private transitionToBuildAgent(): void {
    this.currentState = { mode: "build", phase: "implement" };
    console.log("🔨 Handoff to BUILD agent");

    // Add handoff message
    this.context.push({
      role: "system",
      content: `## HANDOVER: PLAN → BUILD

The planning phase is complete. You are now in BUILD mode.
You have the execution plan from the plan agent.
Your job: Implement and validate until LSP checks pass.`,
    });
  }

  private getNextPlanPhase(currentPhase: PlanPhase): PlanPhase {
    const transitions: Record<PlanPhase, PlanPhase> = {
      analyze_code: "research",
      research: "design",
      design: "implement", // Will trigger handoff
    };
    return transitions[currentPhase];
  }

  private isPlanComplete(): boolean {
    // Check if design phase produced a plan
    const lastMessage = this.context[this.context.length - 1];
    return lastMessage?.content?.includes("## EXECUTION PLAN") ?? false;
  }

  // ==========================================================================
  // BUILD AGENT METHODS
  // ==========================================================================

  private async runBuildPhase(): Promise<void> {
    const phase = this.currentState.phase;

    const buildAgent = new Agent(AGENT_CONFIGS.build);

    const decision = await buildAgent.generate({
      messages: this.buildMessages(),
      tools: this.getToolsForAgent("build"),
      system: this.buildTransitionNotice({ mode: "build", phase }),
    });

    this.context.push({ role: "assistant", content: decision.content });

    // Recursive transition logic
    if (phase === "implement") {
      this.currentState = { mode: "build", phase: "validate" };
      console.log("✅ Implementation complete, validating...");
    } else if (phase === "validate") {
      const hasErrors = this.hasValidationErrors(decision);

      if (hasErrors) {
        this.currentState = { mode: "build", phase: "implement" };
        console.log("❌ Validation failed, fixing errors...");
      } else {
        console.log("✅ Validation passed!");
        // Will trigger done in main loop
      }
    }
  }

  private hasValidationErrors(decision: LLMDecision): boolean {
    // Parse LSP results from decision
    const content = decision.content?.toLowerCase() || "";

    // Check for error indicators
    const errorIndicators = [
      "error:",
      "errors found",
      "typescript error",
      "eslint error",
      "failed",
      "×", // X symbol for errors
    ];

    return errorIndicators.some(indicator => content.includes(indicator));
  }

  private isBuildComplete(): boolean {
    const lastMessage = this.context[this.context.length - 1];
    const content = lastMessage?.content?.toLowerCase() || "";

    // Check for success indicators
    const successIndicators = [
      "validation passed",
      "no errors found",
      "all checks passed",
      "lsp clean",
      "✅",
    ];

    return successIndicators.some(indicator => content.includes(indicator));
  }

  // ==========================================================================
  // MESSAGE BUILDING
  // ==========================================================================

  private buildMessages(): Message[] {
    const messages: Message[] = [];

    // Add transition notice if state changed
    if (this.lastState !== JSON.stringify(this.currentState)) {
      messages.push({
        role: "system",
        content: this.buildTransitionNotice(this.currentState),
      });
      this.lastState = JSON.stringify(this.currentState);
    }

    messages.push(...this.context);
    return messages;
  }

  private buildTransitionNotice(state: HierarchicalState): string {
    if (state.mode === "plan") {
      return PLAN_PHASE_NOTICES[state.phase];
    } else {
      return BUILD_PHASE_NOTICES[state.phase];
    }
  }

  // ==========================================================================
  // TOOL ACCESS
  // ==========================================================================

  private getToolsForAgent(agent: AgentMode): Tool[] {
    const config = AGENT_TOOLS[agent];
    return config.enable.map(name => TOOL_REGISTRY[name]());
  }

  private getToolsForSubagent(subagent: string): Tool[] {
    const config = SUBAGENT_CONFIGS[subagent];
    return config.tools.map(name => TOOL_REGISTRY[name]());
  }

  // ==========================================================================
  // RESULT BUILDING
  // ==========================================================================

  private buildResult(): RLMResult {
    return {
      success: this.currentState === "done",
      state: this.currentState,
      context: this.context,
      iterations: this.context.length,
    };
  }
}

// ============================================================================
// PLAN PHASE CONFIGURATION
// ============================================================================

interface PlanPhaseConfig {
  spawnSubagent: boolean;
  description: string;
}

const PLAN_PHASE_CONFIG: Record<PlanPhase, PlanPhaseConfig> = {
  analyze_code: {
    spawnSubagent: true, // Spawns explore subagent
    description: "Understand codebase structure",
  },

  research: {
    spawnSubagent: false,
    description: "Research best practices and patterns",
  },

  design: {
    spawnSubagent: false,
    description: "Create implementation plan",
  },
};

// ============================================================================
// TRANSITION NOTICES
// ============================================================================

const PLAN_PHASE_NOTICES: Record<PlanPhase, string> = {
  analyze_code: `## 🔍 PLAN AGENT → ANALYZE CODE PHASE

Understanding codebase structure.
SPAWNING: EXPLORE subagent (gpt-4o-mini) for cost-efficient exploration.
You cannot modify any files.
Explore: grep, glob, readFile, astParse`,

  research: `## 🔬 PLAN AGENT → RESEARCH PHASE

Researching best practices and patterns.
Use sequentialThinking for complex analysis.
Available: webSearch, docsLookup, gitLog, sequentialThinking
You cannot modify any files.`,

  design: `## 🎨 PLAN AGENT → DESIGN PHASE

Creating detailed implementation plan.
Use sequentialThinking for architecture decisions.
Output: Structured plan for BUILD agent.
Available: sequentialThinking, createPlan, validatePlan
You cannot modify any files.`,
};

const BUILD_PHASE_NOTICES: Record<BuildPhase, string> = {
  implement: `## 🔨 BUILD AGENT → IMPLEMENT PHASE

Executing the plan with task management.
Track progress with TodoWrite.
If stuck: Use webSearch/docsLookup for error documentation.
Write: editFile, generateCode, formatCode
Tasks: TodoWrite, TodoRead, TaskGet, TaskList`,

  validate: `## ✅ BUILD AGENT → VALIDATE PHASE

Running LSP checks (TypeScript, ESLint).
If errors found: Research documentation → Fix → Validate again.
Emergency: webSearch, docsLookup available for error research.
Validate: typescriptCheck, eslintCheck, lspDiagnostics`,
};
```

---

## Tool Access Patterns and Prompt Caching

### How LLM APIs Handle Tools

**Critical Understanding**: Tools are NOT part of the system prompt - they're a separate parameter passed PER LLM call.

```typescript
// OpenAI/Anthropic API call structure
const response = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  messages: conversationHistory,  // The conversation
  system: systemPrompt,            // System instructions (cached)
  tools: [                         // ← SEPARATE parameter, per call!
    { type: "function", function: { name: "grep", ... } },
    { type: "function", function: { name: "editFile", ... } },
    // You can include/exclude different tools each call
  ],
  tool_choice: "auto"
});
```

**This means**:

- Tools array can change on every call
- Tools are NOT cached like system prompts
- Dynamic tool filtering is fully supported by LLM APIs

### Prompt Caching Implications

**How Prompt Caching Works:**

Prompt caching (Anthropic Claude, OpenAI) caches **prefixes** of your request:

```
[system prompt]        ← cachable prefix
[messages history]     ← cachable prefix (growing)
[tools array]          ← part of request payload
[current user message] ← changes each time
```

**If you change the `tools` array, you change the prefix → cache miss.**

### Recommended: Transition-Aware Steering Pattern

**✅ Hybrid Approach: Runtime Filter + System Prompt Steering**

This approach combines:

1. **Option 1**: Always pass all tools (cache-friendly)
2. **Option 3**: Steer LLM via system prompts (only on transitions)
3. **Runtime filter**: Catch disabled tool calls (safety net)

#### Key Insight: Steering Only on Transitions

```typescript
export class HierarchicalRLMEngine {
  private lastState: string | null = null;
  private context: Message[] = [];
  private allTools: Tool[]; // Built once, constant

  constructor(private llm: LLMService) {
    // Build ALL tools once (cacheable)
    this.allTools = Object.values(TOOL_REGISTRY).map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private buildMessages(): Message[] {
    const messages: Message[] = [];

    // ONLY add transition notice on state change
    if (this.lastState !== JSON.stringify(this.currentState)) {
      messages.push({
        role: "system",
        content: this.buildTransitionNotice(this.currentState),
      });
      this.lastState = JSON.stringify(this.currentState);
    }

    // Append conversation history
    messages.push(...this.context);

    return messages;
  }

  private async handleToolCall(toolCall: ToolCall): Promise<void> {
    const toolName = toolCall.name;
    const mode = this.currentState.mode;

    // Get disabled tools for current agent mode
    const disabledSet = new Set(AGENT_TOOLS[mode].disable);

    // Runtime filter (safety net)
    if (disabledSet.has(toolName)) {
      this.context.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: `❌ Tool "${toolName}" is not available in ${mode} mode. Available: ${AGENT_TOOLS[mode].enable.join(", ")}`,
      });
      return;
    }

    // Execute tool
    const result = await TOOL_REGISTRY[toolName].execute(toolCall.arguments);
    this.context.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(result),
    });
  }
}
```

#### Message Flow Example

```
Iteration 1 (plan/analyze_code):
  System: "## 🔍 PLAN AGENT → ANALYZE CODE..."
  User: "Fix the auth bug"

Iteration 2 (plan/research - state changed):
  System: "## 🔬 PLAN AGENT → RESEARCH PHASE..."
  [Transition notice added]
  Assistant: (webSearch tool call)
  Tool: (search results)

Iteration 3 (plan/design - state changed):
  System: "## 🎨 PLAN AGENT → DESIGN PHASE..."
  [Transition notice added]
  Assistant: (createPlan tool call)

Iteration 4 (build/implement - agent handoff):
  System: "## 🔨 BUILD AGENT → IMPLEMENT PHASE..."
  System: "## HANDOVER: PLAN → BUILD..."
  [Transition notices added]
  Assistant: (editFile tool call)
```

### Benefits

| Aspect                 | Benefit                               |
| ---------------------- | ------------------------------------- |
| **Cache hit rate**     | ~95% (constant tools + system)        |
| **Context efficiency** | No repeated state messages            |
| **LLM alignment**      | Clear boundary markers on transitions |
| **Runtime safety**     | Filter catches mistakes anyway        |
| **Debugging**          | Easy to trace agent/phase changes     |

### Comparison Summary

| Approach             | Cache Hit Rate | LLM Alignment | Complexity | Reliability |
| -------------------- | -------------- | ------------- | ---------- | ----------- |
| Dynamic filtering    | ~0%            | ✅ Perfect    | Low        | ✅ High     |
| Hybrid (recommended) | ~95%           | ✅ Good       | Medium     | ✅ High     |
| System prompt only   | ~99%           | ⚠️ Poor       | Low        | ❌ Low      |

---

## Doom Loop Detection

### OpenCode-Style Pattern Detection

```typescript
class DoomLoopDetector {
  private recentStates: Array<{ state: HierarchicalState; timestamp: number }> = [];

  check(currentState: HierarchicalState): boolean {
    this.recentStates.push({ state: currentState, timestamp: Date.now() });

    // Keep last 10 states
    if (this.recentStates.length > 10) {
      this.recentStates.shift();
    }

    // Check for oscillation pattern (implement → validate → implement → validate...)
    const recentPhases = this.recentStates.map(s => s.state);
    const oscillationCount = this.countOscillations(recentPhases);

    // If we oscillate more than 5 times without progress
    if (oscillationCount > 5 && !this.hasProgress()) {
      return true; // Doom loop detected
    }

    return false;
  }

  private countOscillations(states: HierarchicalState[]): number {
    let count = 0;
    for (let i = 1; i < states.length; i++) {
      const prevPhase = states[i - 1].mode === "build" ? states[i - 1].phase : "";
      const currPhase = states[i].mode === "build" ? states[i].phase : "";

      if (prevPhase && currPhase && prevPhase !== currPhase) {
        count++;
      }
    }
    return count;
  }

  private hasProgress(): boolean {
    // Check if errors are decreasing over time
    // This would need to be tracked separately in context
    return false; // Placeholder - implement based on error counts
  }
}
```

### Detection Strategy

**Patterns that indicate doom loops:**

1. **State Oscillation**: implement → validate → implement → validate (5+ times)
2. **Same Tool Calls**: Identical editFile calls with same parameters
3. **No Error Reduction**: Error count stays same or increases
4. **Time Threshold**: Been in build mode for too long (>10 minutes)

**Recovery Actions:**

1. **Alert user**: "Agent stuck in fix loop, manual intervention needed"
2. **Switch to plan mode**: Re-analyze the problem
3. **Abort gracefully**: Return partial results with error summary

---

## Testing Strategy

### Unit Tests

```typescript
describe("HierarchicalRLMEngine", () => {
  it("should transition through plan phases linearly", async () => {
    const engine = new HierarchicalRLMEngine(mockLLM, "test goal");
    const result = await engine.execute();

    expect(result.state).toHaveProperty("mode", "done");
  });

  it("should spawn explore subagent for analyze_code", async () => {
    const engine = new HierarchicalRLMEngine(mockLLM, "test goal");
    const subagentSpy = jest.spyOn(engine, "spawnExploreAgent");

    await engine.execute();

    expect(subagentSpy).toHaveBeenCalled();
  });

  it("should prevent write operations in plan mode", () => {
    const planTools = AGENT_TOOLS.plan.disable;

    expect(planTools).toContain("editFile");
    expect(planTools).toContain("generateCode");
    expect(planTools).toContain("TodoWrite");
  });

  it("should detect doom loops in build agent", () => {
    const detector = new DoomLoopDetector();

    // Simulate oscillation
    for (let i = 0; i < 6; i++) {
      detector.check({ mode: "build", phase: "implement" });
      detector.check({ mode: "build", phase: "validate" });
    }

    expect(detector.check({ mode: "build", phase: "implement" })).toBe(true);
  });
});
```

---

## Deployment Considerations

### Environment Variables

```bash
# LLM Configuration
PLAN_MODEL=gpt-4o
PLAN_MODEL_TEMP=0.7
BUILD_MODEL=claude-3-5-sonnet-20241022
BUILD_MODEL_TEMP=0.3
EXPLORE_MODEL=gpt-4o-mini
EXPLORE_MODEL_TEMP=0.3

# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Storage
POSTGRES_URL=postgresql://localhost:5432/rlm
POSTGRES_USER=rlm
POSTGRES_PASSWORD=secret

# Vector DB (for memory)
VECTOR_DB_URL=http://localhost:6333

# MCP Servers
MCP_FILESYSTEM_SERVER=http://localhost:3000
MCP_GITHUB_SERVER=http://localhost:3001
MCP_LSP_SERVER=http://localhost:3002

# Execution
MAX_BUILD_ITERATIONS=10
BUILD_TIMEOUT_MS=300000
DOOM_LOOP_THRESHOLD=5
```

### Docker Compose

```yaml
version: "3.8"

services:
  rlm-engine:
    build: .
    environment:
      - PLAN_MODEL=gpt-4o
      - BUILD_MODEL=claude-3-5-sonnet-20241022
      - EXPLORE_MODEL=gpt-4o-mini
      - POSTGRES_URL=postgres://postgres:password@db:5432/rlm
      - VECTOR_DB_URL=http://vector:6333
    depends_on:
      - db
      - vector

  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=rlm
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=rlm
    volumes:
      - postgres_data:/var/lib/postgresql/data

  vector:
    image: pgvector/pgvector:pg16
    ports:
      - "6333:6333"
    environment:
      - POSTGRES_USER=rlm
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=rlm
    volumes:
      - vector_data:/var/lib/postgresql/data

volumes:
  postgres_data:
  vector_data:
```

---

## Summary

### Key Architectural Decisions

| Decision                        | Rationale                                            |
| ------------------------------- | ---------------------------------------------------- |
| **2-Agent System**              | Clear separation: Plan (read-only) vs Build (write)  |
| **Hierarchical States**         | Parent (agent) + Child (phase) structure             |
| **Selective Subagent Spawning** | Only analyze_code spawns explore (cost optimization) |
| **Capability-Based Tools**      | Plan = read-only, Build = write + emergency research |
| **Recursive Build Loop**        | Self-healing via LSP validation                      |
| **Doom Loop Detection**         | OpenCode-style pattern detection                     |
| **Transition-Aware Steering**   | ~95% cache hit rate with state notices               |
| **Task Management**             | Build agent tracks progress with TodoWrite/Read      |

### Agent Responsibilities

**Plan Agent:**

- Understand codebase (via explore subagent)
- Research best practices
- Create detailed implementation plan
- Output: Structured plan for Build agent

**Build Agent:**

- Execute plan with task management
- Validate with LSP checks
- Research error documentation when stuck
- Recursively fix until clean
- Track progress with TodoWrite/Read

### Next Steps

1. Implement HierarchicalRLMEngine with plan/build modes
2. Create explore subagent with gpt-4o-mini
3. Integrate LSP tools for validation
4. Implement task management (TodoWrite/Read)
5. Add doom loop detection
6. Build transition notice templates
7. Integrate with Mastra (optional) for orchestration
8. Add storage persistence for state/history
9. Write tests for state transitions
10. Deploy with Docker Compose

---

## Appendix: Quick Reference

### State Transition Rules

**Plan Agent (Linear):**

```
analyze_code → research → design → build (handoff)
```

**Build Agent (Recursive):**

```
implement → validate
validate → implement (if errors)
validate → done (if clean)
```

### Tool Availability by Agent

| Tool Category        | Plan Agent | Build Agent       |
| -------------------- | ---------- | ----------------- |
| **Read tools**       | ✅ All     | ✅ Minimal        |
| **Write tools**      | ❌ None    | ✅ All            |
| **Research tools**   | ✅ Full    | ⚠️ Emergency only |
| **Planning tools**   | ✅ All     | ❌ None           |
| **Validation tools** | ❌ None    | ✅ All            |
| **Task management**  | ❌ None    | ✅ All            |

### Model Selection

| Agent              | Model                      | Temperature | Purpose                    |
| ------------------ | -------------------------- | ----------- | -------------------------- |
| Plan               | gpt-4o                     | 0.7         | Strategic reasoning        |
| Explore (subagent) | gpt-4o-mini                | 0.3         | Cost-effective exploration |
| Build              | claude-3.5-sonnet-20241022 | 0.3         | Precise code editing       |

### Emergency Research Triggers

Build agent should use emergency research when:

1. TypeScript errors with unknown codes
2. ESLint rules with unclear messages
3. LSP diagnostics requiring API docs
4. Implementation patterns not in plan

**Emergency research flow:**

```
Error encountered
  ↓
Can I fix from context?
  ├─ YES → Fix directly
  └─ NO → Emergency research
     ├─ webSearch("TypeScript error TS...")
     ├─ docsLookup("eslint rule...")
     └─ Apply fix from documentation
  ↓
Re-validate
```
