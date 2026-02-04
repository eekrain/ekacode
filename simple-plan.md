# OpenCode-Inspired Agentic Workflow Implementation Plan

## Executive Summary

Migrate from rigid 3-phase workflow (explore→plan→build) to OpenCode's flexible agent-driven architecture where:

- **Build Agent is the default entry point** with all tools available
- **LLM decides complexity** - simple queries get direct responses, complex ones use tools
- **Task tool spawns subagents** only when the build agent explicitly requests them
- **Plan mode is optional** - enabled via config, not forced by default

---

## Current Problems

1. **Over-engineering**: "hi?" triggers full explore→plan→build pipeline (3 API calls minimum)
2. **No decision layer**: Hardcoded workflow ignores query complexity
3. **Wasted resources**: Exploration runs even for simple questions
4. **Poor UX**: Long latency for simple conversational messages
5. **Inflexible**: Cannot adapt to query type without code changes

---

## Target Architecture

```
User Message
     ↓
Build Agent (default, all tools available)
     ↓
┌─────────────────────────────────────┐
│ LLM decides based on system prompt: │
│                                     │
│ Simple query? → Direct text response│
│ Need context? → Call explore tool   │
│ Need planning? → Call task tool     │
│ Direct changes? → Use edit tools    │
└─────────────────────────────────────┘
```

### Key Principles from OpenCode

1. **Agent-per-session**: One agent handles the conversation, not a workflow engine
2. **Tool-driven complexity**: LLM uses tools when needed, skips them when not
3. **Subagent spawning**: Task tool creates child sessions for parallel/concurrent work
4. **Rich system prompts**: Guide LLM behavior instead of hardcoded logic
5. **Optional plan mode**: User enables structured planning when wanted

---

## Phase 1: Foundation Changes (Remove Rigid Workflow)

### 1.1 Delete WorkflowEngine

**Files to remove:**

- `packages/core/src/workflow/engine.ts` - Entire rigid orchestration
- `packages/core/src/workflow/` directory - If only contains engine

**Migration:**
Move any useful utility functions from engine to appropriate locations before deletion.

### 1.2 Simplify SessionController

**File:** `packages/core/src/session/controller.ts`

**Changes:**

- Remove `workflow` property and workflow-related methods
- Remove `start()`, `pause()`, `resume()` workflow methods
- Keep session management (messages, state, streaming)
- Add simple `processMessage()` that calls agent directly

**Before:**

```typescript
class SessionController {
  private workflow: WorkflowEngine;

  async start(message: string) {
    await this.workflow.start(message); // Hardcoded 3-phase
  }
}
```

**After:**

```typescript
class SessionController {
  async processMessage(message: string) {
    const agent = await this.getDefaultAgent();
    await this.runAgent(agent, message); // Single agent execution
  }
}
```

### 1.3 Update Chat Route

**File:** `packages/server/src/routes/chat.ts`

**Changes:**

- Remove workflow monitoring code
- Simplify to: create session → process message → stream response
- Remove phase tracking ("exploring", "planning", "building")

**Before:**

```typescript
const workflowPromise = controller.start(messageText);
// Complex phase monitoring and progress tracking
```

**After:**

```typescript
const responseStream = controller.processMessage(messageText);
// Simple streaming of agent response
```

---

## Phase 2: Agent System Overhaul

### 2.1 Redefine Agent Types

**File:** `packages/core/src/agent/workflow/types.ts` (or new location)

**New agent structure:**

```typescript
interface Agent {
  name: string;
  mode: "primary" | "subagent";
  hidden?: boolean;
  systemPrompt: string;
  tools: string[]; // Tool names available to this agent
  model: string;
  maxIterations?: number;
}

const DEFAULT_AGENTS: Record<string, Agent> = {
  build: {
    name: "build",
    mode: "primary",
    systemPrompt: "...", // Rich prompt guiding when to use tools
    tools: ["read", "write", "edit", "bash", "task", "search", "webfetch"],
    model: "glm-4.7",
    maxIterations: 50,
  },
  explore: {
    name: "explore",
    mode: "subagent",
    hidden: true,
    systemPrompt: "...", // Read-only exploration prompt
    tools: ["read", "ls", "glob", "grep", "search", "webfetch"],
    model: "glm-4.7-flashx",
    maxIterations: 30,
  },
  plan: {
    name: "plan",
    mode: "subagent",
    hidden: true,
    systemPrompt: "...", // Planning prompt with plan_exit tool
    tools: ["read", "ls", "task", "search", "webfetch", "plan_exit"],
    model: "glm-4.7",
    maxIterations: 100,
  },
};
```

### 2.2 Create Agent Factory

**File:** `packages/core/src/agent/factory.ts`

**Purpose:** Create agent instances with proper configuration

```typescript
export async function createAgent(name: string, context: AgentContext): Promise<AgentInstance> {
  const config = DEFAULT_AGENTS[name];
  if (!config) throw new Error(`Unknown agent: ${name}`);

  return {
    config,
    tools: resolveTools(config.tools),
    model: await loadModel(config.model),
    context,
  };
}

export async function getDefaultAgent(): Promise<string> {
  // Return "build" as default
  return "build";
}
```

### 2.3 Update Agent Processor

**File:** `packages/core/src/session/processor.ts`

**Changes:**

- Accept agent configuration instead of hardcoded parameters
- Use agent's tool list instead of phase-based tool selection
- Keep iteration loop and streaming logic
- Add doom loop detection (already exists, keep it)

---

## Phase 3: Task Tool Implementation (Subagent Spawning)

### 3.1 Create Task Tool

**File:** `packages/core/src/tools/task.ts`

**Purpose:** Allow agents to spawn subagents for parallel/concurrent work

```typescript
import { tool } from "ai";
import { z } from "zod";

export const taskTool = tool({
  name: "task",
  description: `Spawn a subagent to handle a specific task. 
Use this when:
- You need to explore the codebase in parallel
- A task can be delegated to a specialized agent
- You need concurrent operations
- The task requires different tool permissions`,

  parameters: z.object({
    description: z.string().describe("Short 3-5 word task description"),
    prompt: z.string().describe("Detailed task instructions"),
    subagent_type: z.enum(["explore", "plan", "general"]).describe("Type of agent to spawn"),
    session_id: z.string().optional().describe("Existing session ID to continue"),
  }),

  execute: async (params, context) => {
    const { description, prompt, subagent_type, session_id } = params;
    const { sessionID, directory } = context;

    // Create child session or use existing
    const childSessionId = session_id || generateSessionId();

    // Create subagent
    const subagent = await createAgent(subagent_type, {
      directory,
      sessionID: childSessionId,
      parentSessionID: sessionID, // Track parent for context
    });

    // Run subagent with prompt
    const result = await runSubagent(subagent, prompt);

    return {
      session_id: childSessionId,
      result: result.text,
      tool_calls: result.toolCalls,
    };
  },
});
```

### 3.2 Session Parent-Child Relationships

**File:** `packages/server/src/db/schema.ts` or session management

**Add parent tracking:**

```typescript
// In sessions table or new subagent_sessions table
interface Session {
  sessionId: string;
  parentSessionId?: string; // For subagents
  agentType: string;
  workspace: string;
  createdAt: Date;
}
```

### 3.3 Subagent Result Streaming

**File:** `packages/core/src/session/processor.ts` or new subagent runner

**Implementation:**

- Subagent runs in isolated session
- Results streamed back to parent via event system
- Parent receives tool result with subagent output
- Support for continuing subagent sessions across multiple turns

---

## Phase 4: Plan Mode (Optional Feature)

### 4.1 Plan Exit Tool

**File:** `packages/core/src/tools/plan-exit.ts`

**Purpose:** Allow plan agent to signal completion and request user approval

```typescript
export const planExitTool = tool({
  name: "plan_exit",
  description: "Complete the planning phase and request user approval to proceed to build",

  parameters: z.object({
    plan_summary: z.string().describe("Summary of the plan created"),
    plan_file_path: z.string().describe("Path to the saved plan file"),
  }),

  execute: async (params, context) => {
    const { plan_summary, plan_file_path } = params;
    const { sessionID } = context;

    // Emit event to UI for user approval
    const approval = await requestUserApproval({
      sessionID,
      question: `Plan complete at ${plan_file_path}. Switch to build agent?`,
      options: ["Yes", "No"],
    });

    if (approval === "No") {
      throw new Error("User rejected plan");
    }

    return {
      approved: true,
      next_agent: "build",
    };
  },
});
```

### 4.2 Plan Mode Configuration

**File:** `packages/core/src/config/plan-mode.ts`

```typescript
export interface PlanModeConfig {
  enabled: boolean; // Default: false
  autoSpawnExplore: boolean; // Spawn explore agents automatically in plan mode
  maxExploreAgents: number; // Default: 3
  requireApproval: boolean; // Require user approval before build
}

export const defaultPlanModeConfig: PlanModeConfig = {
  enabled: false,
  autoSpawnExplore: true,
  maxExploreAgents: 3,
  requireApproval: true,
};
```

### 4.3 Conditional Plan Mode Activation

**In plan agent system prompt (only when plan mode enabled):**

```
You are in PLAN MODE. Follow this workflow:

Phase 1: Understanding
- Use task tool to spawn up to 3 explore agents in parallel
- Gather information about the codebase

Phase 2: Design
- Analyze requirements and design solution
- Use task tool to spawn general agents for research if needed

Phase 3: Review
- Review findings and finalize approach

Phase 4: Documentation
- Write complete plan to .ekacode/plan.md

Phase 5: Exit
- Call plan_exit tool to request user approval
```

---

## Phase 5: System Prompts

### 5.1 Build Agent System Prompt

**File:** `packages/core/src/agent/prompts/build.txt`

```
You are ekacode, an AI coding assistant. You help users with software engineering tasks.

CAPABILITIES:
- Read and understand code (read, ls, glob, grep)
- Edit and create files (write, edit, multiedit, apply_patch)
- Run commands (bash)
- Search documentation and web (search_docs, webfetch)
- Spawn subagents for complex tasks (task tool)

WHEN TO USE TOOLS:
- Simple questions about code → Use read/ls/grep directly
- Complex codebase exploration → Use task tool to spawn explore agent
- Need structured planning → Use task tool to spawn plan agent
- Making changes → Use edit tools directly
- General questions → Respond without tools

WORKFLOW:
1. Understand the user's request
2. Determine if you need tools:
   - If yes and simple → Use tools directly
   - If yes and complex → Spawn appropriate subagent
   - If no → Respond conversationally
3. Execute efficiently
4. Provide clear, concise responses

IMPORTANT:
- Don't over-engineer simple requests
- Use subagents when you need parallel work or different tool permissions
- Always verify file changes were successful
- Explain your reasoning when making significant changes
```

### 5.2 Explore Agent System Prompt

**File:** `packages/core/src/agent/prompts/explore.txt`

```
You are an exploration agent. Your job is to understand the codebase structure and find relevant information.

TOOLS AVAILABLE:
- read: Read file contents
- ls: List directory contents
- glob: Find files by pattern
- grep: Search file contents
- search_docs: Search documentation
- webfetch: Fetch web resources

YOUR TASK:
{{TASK_DESCRIPTION}}

INSTRUCTIONS:
1. Start by understanding the directory structure
2. Search for relevant files and patterns
3. Read key files to understand implementation
4. Provide a comprehensive summary of findings

OUTPUT FORMAT:
Return a structured summary of:
- Files examined
- Key findings
- Relevant code sections
- Recommendations for next steps
```

### 5.3 Plan Agent System Prompt

**File:** `packages/core/src/agent/prompts/plan.txt`

```
You are a planning agent. Your job is to create detailed implementation plans.

{{PLAN_MODE_INSTRUCTIONS}} // Injected conditionally based on config

TOOLS AVAILABLE:
- All read tools
- task: Spawn subagents (explore, general)
- search_docs: Research patterns
- webfetch: Look up best practices
- plan_exit: Complete planning and request approval

YOUR TASK:
{{TASK_DESCRIPTION}}

INSTRUCTIONS:
1. Gather information using explore subagents
2. Research patterns and best practices
3. Design the solution
4. Document the plan in detail
5. Call plan_exit when ready

OUTPUT:
Create a comprehensive plan at .ekacode/plan.md including:
- Problem statement
- Proposed solution
- Implementation steps
- File changes needed
- Testing considerations
```

---

## Phase 6: UI Updates

### 6.1 Remove Phase Indicators

**Files:**

- `apps/desktop/src/views/workspace-view/index.tsx`
- Any components showing "Exploring...", "Planning...", "Building..."

**Changes:**

- Remove phase progress UI
- Keep simple loading indicator
- Show agent name if relevant ("Build Agent", "Explore Agent")

### 6.2 Subagent Visualization (Optional)

**New feature:** Show when subagents are spawned

```typescript
// In message list, show subagent calls as special message type
interface SubagentCallPart {
  type: "subagent-call";
  agentType: string;
  description: string;
  status: "running" | "completed" | "error";
  result?: string;
}
```

### 6.3 Plan Approval UI

**File:** `apps/desktop/src/components/permission-dialog.tsx` or new component

**Handle plan_exit tool events:**

- Show plan summary
- Display approve/reject buttons
- On approve: Switch to build agent
- On reject: Stay in plan agent, allow refinement

---

## Phase 7: Migration Strategy

### 7.1 Backward Compatibility

**Config flag for gradual migration:**

```typescript
// ekacode.config.json
{
  "agentMode": "legacy" | "new", // Default to "legacy" initially
  "planMode": false // Disabled by default
}
```

### 7.2 Testing Strategy

**Test cases:**

1. "hi?" → Should get direct response (no tools, fast)
2. "What does the auth system do?" → Should use read/grep tools directly
3. "Find all API routes" → Should spawn explore agent
4. "Implement user authentication" → Should spawn plan agent (if plan mode on)
5. "Fix the bug in utils.ts" → Should use edit tools directly

### 7.3 Rollout Plan

**Week 1:** Implement Phase 1-2 (remove workflow, single agent)
**Week 2:** Implement Phase 3 (task tool, subagents)
**Week 3:** Implement Phase 4-5 (plan mode, system prompts)
**Week 4:** UI updates and testing
**Week 5:** Remove legacy mode, make new mode default

---

## File Changes Summary

### Delete

- `packages/core/src/workflow/engine.ts`
- `packages/core/src/workflow/` (entire directory)

### Major Changes

- `packages/core/src/session/controller.ts` - Remove workflow, simplify to single agent
- `packages/core/src/session/processor.ts` - Use agent config instead of phase-based
- `packages/server/src/routes/chat.ts` - Remove workflow monitoring, simplify streaming
- `packages/core/src/agent/workflow/` - Replace with new agent system

### New Files

- `packages/core/src/agent/factory.ts` - Agent creation
- `packages/core/src/agent/prompts/build.txt` - Build agent prompt
- `packages/core/src/agent/prompts/explore.txt` - Explore agent prompt
- `packages/core/src/agent/prompts/plan.txt` - Plan agent prompt
- `packages/core/src/tools/task.ts` - Subagent spawning
- `packages/core/src/tools/plan-exit.ts` - Plan completion
- `packages/core/src/config/plan-mode.ts` - Plan mode configuration

### Minor Changes

- `packages/core/src/agent/workflow/types.ts` - Update agent type definitions
- `packages/core/src/tools/registry.ts` - Add task and plan_exit tools
- `packages/server/src/db/schema.ts` - Add parent_session_id tracking
- `apps/desktop/src/views/workspace-view/index.tsx` - Remove phase UI

---

## Success Metrics

1. **Latency**: "hi?" should respond in <2 seconds (vs current 10+ seconds)
2. **Cost**: Simple queries should use 1 API call (vs current 3+)
3. **Flexibility**: Can handle any query type without code changes
4. **User Control**: Plan mode is opt-in, not forced
5. **Maintainability**: Simpler code, fewer moving parts

---

## Open Questions

1. **Model selection**: Should all agents use same model or different models for cost optimization?
2. **Tool permissions**: Should we keep phase-based tool restrictions or let build agent have all tools?
3. **Session persistence**: How long should subagent sessions live?
4. **Error handling**: What happens when subagent fails?
5. **Parallel limits**: How many concurrent subagents allowed?

---

## Next Steps

1. Review this plan with team
2. Decide on open questions
3. Create feature branch
4. Start with Phase 1 (remove workflow)
5. Test each phase before proceeding

**Estimated Timeline:** 4-5 weeks for complete migration
**Risk Level:** Medium (significant architectural change)
**Rollback Plan:** Keep config flag to switch back to legacy mode
