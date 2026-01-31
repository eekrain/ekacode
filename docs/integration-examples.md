# Integration Examples

This guide provides practical examples for integrating with ekacode's core features.

## Table of Contents

1. [Chat API](#chat-api)
2. [search-docs Tool](#search-docs-tool)
3. [RLM Machine](#rlm-machine)
4. [Tools Registry](#tools-registry)
5. [Sequential Thinking](#sequential-thinking)

---

## Chat API

The chat API provides a REST endpoint for AI-powered code assistance with session management and streaming responses.

### Basic Usage

**Simple text message:**

```bash
curl -X POST http://localhost:4096/api/chat?directory=/path/to/workspace \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: optional-session-id" \
  -d '{
    "message": "Create a function that adds two numbers",
    "stream": true
  }'
```

**Response (UIMessage stream):**

````
5:m:["session",{"sessionId":"0193abcd...","resourceId":"res-123"}]

3:d["Hello! I'll help you create a function that adds two numbers."]

5:m["text-delta","0193abcd...","Here's a simple implementation in TypeScript:\n\n```typescript"]

5:m["text-delta","0193abcd...","\nfunction add(a: number, b: number): number {\n  return a + b;\n}"]

...

5:m["finish","stop"]
````

### Multimodal Support

**Message with image URL:**

```bash
curl -X POST http://localhost:4096/api/chat?directory=/path/to/workspace \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "content": [
        { "type": "text", "text": "What does this image show?" },
        { "type": "image", "image": { "url": "https://example.com/screenshot.png" } }
      ]
    },
    "stream": true
  }'
```

**Message with base64 image:**

```bash
curl -X POST http://localhost:4096/api/chat?directory=/path/to/workspace \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "content": [
        { "type": "text", "text": "Analyze this screenshot" },
        {
          "type": "file",
          "mediaType": "image/png",
          "data": "iVBORw0KGgoAAAANSUhEUgAA..."
        }
      ]
    },
    "stream": true
  }'
```

### Session Management

**Get current session info:**

```bash
curl -X GET http://localhost:4096/api/chat/session \
  -H "X-Session-ID: your-session-id"
```

**Response:**

```json
{
  "sessionId": "0193abcd-1234-5678-9abc-def012345678",
  "resourceId": "res-123",
  "threadId": "thread-456",
  "createdAt": "2026-01-30T10:00:00.000Z",
  "lastAccessed": "2026-01-30T10:05:00.000Z"
}
```

### TypeScript Client Example

```typescript
import { createUIMessageStreamParser } from "ai";

async function sendMessage(message: string, directory: string, sessionId?: string): Promise<void> {
  const response = await fetch(
    `http://localhost:4096/api/chat?directory=${encodeURIComponent(directory)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionId && { "X-Session-ID": sessionId }),
      },
      body: JSON.stringify({ message, stream: true }),
    }
  );

  const parser = createUIMessageStreamParser();

  for await (const chunk of response.body!) {
    const messages = parser.parse(chunk.toString());
    for (const msg of messages) {
      switch (msg.type) {
        case "session":
          console.log("Session:", msg.session);
          break;
        case "text-delta":
          process.stdout.write(msg.delta);
          break;
        case "finish":
          console.log("\nDone:", msg.finishReason);
          break;
        case "error":
          console.error("Error:", msg.errorText);
          break;
      }
    }
  }
}

// Usage
await sendMessage("List all files in src/", "/home/user/project");
```

---

## search-docs Tool

The search-docs tool enables code research across external repositories without cloning them locally.

### Using search-docs Directly

```typescript
import { generateText } from "ai";
import { createZai } from "@ai-sdk/zai";
import { searchDocs } from "@ekacode/core/tools";

const zai = createZai({ apiKey: process.env.ZAI_API_KEY });

const result = await generateText({
  model: zai("glm-4.7"),
  tools: {
    "search-docs": searchDocs,
  },
  messages: [
    {
      role: "user",
      content: "How do I use streamText from Vercel AI SDK?",
    },
  ],
  maxSteps: 10,
});

console.log(result.text);
```

### Using Individual Code Research Tools

**AST Query:**

```typescript
import { astQuery } from "@ekacode/core/tools";

const result = await generateText({
  model: zai("glm-4.7"),
  tools: {
    "ast-query": astQuery,
  },
  messages: [
    {
      role: "user",
      content: "Find all function definitions in vercel/ai-sdk",
    },
  ],
});
```

**Grep Search:**

```typescript
import { grepSearch } from "@ekacode/core/tools";

const result = await generateText({
  model: zai("glm-4.7"),
  tools: {
    "grep-search": grepSearch,
  },
  messages: [
    {
      role: "user",
      content: "Search for 'streamText' usage examples in vercel/ai-sdk",
    },
  ],
});
```

**File Read:**

```typescript
import { fileRead } from "@ekacode/core/tools";

const result = await generateText({
  model: zai("glm-4.7"),
  tools: {
    "file-read-docs": fileRead,
  },
  messages: [
    {
      role: "user",
      content: "Read the README from vercel/ai-sdk repository",
    },
  ],
});
```

### search-docs Tool Options

The `searchDocs` tool accepts:

- `query` (string): Your question about the code
- `repository` (string, optional): GitHub repository URL or npm package name
- `sessionId` (string, optional): Session ID for research context persistence
- `sessionLimit` (number, optional): Max number of tool calls (default: 50)

---

## RLM Machine

The RLM (Reasoning, Loop control, Multimodal) Machine is the core XState-based workflow orchestration system.

### Creating an RLM Actor

```typescript
import { createRLMActor } from "@ekacode/core/state";

const actor = createRLMActor({
  goal: "Implement a REST API for user management",
  workspace: "/path/to/project",
  maxIterations: 20,
});

// Subscribe to state changes
actor.subscribe({
  next: snapshot => {
    console.log("State:", snapshot.value);
    console.log("Messages:", snapshot.context.messages);
    console.log("Iteration:", snapshot.context.iterationCount);
  },
  error: error => {
    console.error("Error:", error);
  },
  complete: () => {
    console.log("Workflow complete");
  },
});

// Start the workflow
actor.start();
```

### Running RLM Workflow (Promise-based)

```typescript
import { runRLMWorkflow } from "@ekacode/core/state";

const result = await runRLMWorkflow({
  goal: "Create a function that validates email addresses",
  workspace: "/path/to/project",
});

if (result.success) {
  console.log("Success!");
  console.log("Messages:", result.messages);
} else {
  console.error("Failed:", result.error);
}
```

### RLM Configuration Options

```typescript
interface RLMConfig {
  goal: string; // Required: The user's request
  messages?: Array<Message>; // Optional: Conversation history
  maxIterations?: number; // Optional: Max iterations (default: 20)
  workspace?: string; // Optional: Working directory
  signal?: AbortSignal; // Optional: Cancellation token
  testMode?: boolean; // Optional: Bypass real AI calls
}
```

### Workflow States

The RLM machine progresses through these hierarchical states:

```
rlm
├── plan
│   ├── analyze_code
│   ├── research
│   └── design
├── build
│   ├── implement
│   ├── validate
│   └── test
├── done
└── failed
```

### Using Individual Agents

**Plan Agent:**

```typescript
import { runPlanAgent } from "@ekacode/core/state";

const planResult = await runPlanAgent({
  goal: "Design a user authentication system",
  workspace: "/path/to/project",
});
```

**Build Agent:**

```typescript
import { runBuildAgent } from "@ekacode/core/state";

const buildResult = await runBuildAgent({
  plan: "Implement JWT authentication",
  workspace: "/path/to/project",
});
```

**Explore Agent:**

```typescript
import { spawnExploreAgent } from "@ekacode/core/state";

const exploreResult = await spawnExploreAgent({
  query: "Find all API endpoint definitions",
  workspace: "/path/to/project",
});
```

---

## Tools Registry

Access all available tools through the tools registry.

### Getting All Tools

```typescript
import { TOOL_REGISTRY } from "@ekacode/core/tools";

// All registered tools
const tools = TOOL_REGISTRY;

console.log(Object.keys(tools));
// Output: ["read", "write", "edit", "bash", "grep", "webfetch", "sequential-thinking", "search-docs", ...]
```

### Using Individual Tools

**Filesystem Tools:**

```typescript
import { readTool, writeTool, editTool, globTool } from "@ekacode/core/tools";

const tools = {
  read: readTool,
  write: writeTool,
  edit: editTool,
  glob: globTool,
};
```

**Shell Tools:**

```typescript
import { bashTool } from "@ekacode/core/tools";

const tools = {
  bash: bashTool,
};
```

**Search Tools:**

```typescript
import { grepTool, webfetchTool } from "@ekacode/core/tools";

const tools = {
  grep: grepTool,
  webfetch: webfetchTool,
};
```

### Creating Tool Combinations

```typescript
import { readTool, writeTool, bashTool, grepTool } from "@ekacode/core/tools";

// Coding task tools
const codingTools = {
  read: readTool,
  write: writeTool,
  bash: bashTool,
  grep: grepTool,
};

// Research task tools
const researchTools = {
  read: readTool,
  grep: grepTool,
  "search-docs": searchDocs,
  "sequential-thinking": sequentialThinking,
};
```

---

## Sequential Thinking

The sequential thinking tool enables structured reasoning with thought chains.

### Basic Usage

```typescript
import { generateText } from "ai";
import { createZai } from "@ai-sdk/zai";
import { sequentialThinking } from "@ekacode/core/tools";

const zai = createZai({ apiKey: process.env.ZAI_API_KEY });

const result = await generateText({
  model: zai("glm-4.7"),
  tools: {
    "sequential-thinking": sequentialThinking,
  },
  messages: [
    {
      role: "user",
      content: "Design a scalable architecture for a chat application",
    },
  ],
  maxSteps: 15,
});
```

### Sequential Thinking Options

The tool accepts:

- `thought` (string): Current thought to record
- `thoughtNumber` (number): Current thought position
- `totalThoughts` (number): Expected total thoughts
- `nextThoughtNeeded` (boolean): Whether more thinking is needed
- `isRevision` (boolean, optional): Whether this revises a previous thought
- `revisesThought` (number, optional): Which thought is being revised
- `branchFromThought` (number, optional): Branch point for alternative reasoning
- `branchId` (string, optional): Branch identifier
- `sessionId` (string, optional): Session ID for persistence

### Using Database Storage

For production use, integrate with Drizzle for persistent storage:

```typescript
import { createSequentialThinkingToolWithDb } from "@ekacode/core/tools";
import { db } from "@ekacode/server/db";

const sequentialThinkingTool = createSequentialThinkingToolWithDb({
  db,
  sessionId: "user-session-id",
});
```

---

## Complete Example: Full Workflow Integration

Here's a complete example showing all components working together:

```typescript
import { createRLMActor } from "@ekacode/core/state";
import { createUIMessageStreamParser } from "ai";

async function runAgentWorkflow(goal: string, workspace: string): Promise<void> {
  // 1. Create RLM actor
  const actor = createRLMActor({
    goal,
    workspace,
  });

  // 2. Set up state tracking
  const stateChanges: Array<{
    value: unknown;
    iterationCount: number;
    lastState: string | null;
  }> = [];

  actor.subscribe({
    next: snapshot => {
      stateChanges.push({
        value: snapshot.value,
        iterationCount: snapshot.context.iterationCount,
        lastState: snapshot.context.lastState,
      });

      // Log state transitions
      console.log(`[${snapshot.context.iterationCount}] State:`, snapshot.value);

      // Extract latest message
      const lastMessage = snapshot.context.messages.at(-1);
      if (lastMessage?.role === "assistant") {
        const content =
          typeof lastMessage.content === "string" ? lastMessage.content : "[multimodal content]";
        process.stdout.write(content);
      }
    },
    error: error => {
      console.error("\nWorkflow error:", error);
    },
    complete: () => {
      console.log("\nWorkflow complete!");
    },
  });

  // 3. Start workflow
  actor.start();

  // 4. Wait for completion
  await new Promise<void>(resolve => {
    const checkInterval = setInterval(() => {
      const snapshot = actor.getSnapshot();
      if (snapshot?.matches("done") || snapshot?.matches("failed")) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  // 5. Report results
  const finalSnapshot = actor.getSnapshot();
  console.log("\n=== Summary ===");
  console.log("Final state:", finalSnapshot?.value);
  console.log("Total iterations:", finalSnapshot?.context.iterationCount);
  console.log("Tool executions:", finalSnapshot?.context.toolExecutionCount);
}

// Usage
await runAgentWorkflow("Create a REST API with user authentication", "/home/user/my-project");
```

---

## Error Handling

### Handling Agent Failures

```typescript
import { runRLMWorkflow } from "@ekacode/core/state";

try {
  const result = await runRLMWorkflow({
    goal: "Implement feature X",
    workspace: "/path/to/project",
  });

  if (!result.success) {
    console.error("Workflow failed:", result.error);

    // Retry with different approach
    const retryResult = await runRLMWorkflow({
      goal: "Implement feature X with a simpler approach",
      workspace: "/path/to/project",
    });
  }
} catch (error) {
  console.error("Unexpected error:", error);
}
```

### Handling API Errors

```typescript
import { createUIMessageStreamParser } from "ai";

async function chatWithErrorHandling(message: string): Promise<void> {
  const response = await fetch("http://localhost:4096/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, stream: true }),
  });

  const parser = createUIMessageStreamParser();

  for await (const chunk of response.body!) {
    const messages = parser.parse(chunk.toString());

    for (const msg of messages) {
      if (msg.type === "error") {
        console.error("Agent error:", msg.errorText);
        // Handle error (retry, notify user, etc.)
        return;
      }
      if (msg.type === "finish" && msg.finishReason === "error") {
        console.error("Workflow terminated with error");
        return;
      }
    }
  }
}
```

---

## Testing

### Mocking RLM Workflow

```typescript
import { createRLMActor } from "@ekacode/core/state";

const testActor = createRLMActor({
  goal: "Test task",
  testMode: true, // Enables test mode
});

// In test mode, the actor will skip actual AI calls
// Use this for testing state transitions and error handling
```

### Testing Tool Execution

```typescript
import { generateText } from "ai";
import { createZai } from "@ai-sdk/zai";
import { readTool, writeTool } from "@ekacode/core/tools";

// Test with specific tools only
const result = await generateText({
  model: zai("glm-4.7"),
  tools: {
    read: readTool,
    write: writeTool,
  },
  messages: [
    {
      role: "system",
      content: "You are a coding assistant. Test mode: read and write only.",
    },
    {
      role: "user",
      content: "Create test.txt with 'Hello, Test!'",
    },
  ],
  maxSteps: 5,
});

console.log("Tool calls:", result.toolCalls);
```

---

## Best Practices

### 1. Always Provide Workspace Context

```typescript
// Good: Explicit workspace
const actor = createRLMActor({
  goal: "Add user authentication",
  workspace: "/home/user/project",
});

// Bad: No workspace (operations may fail)
const actor = createRLMActor({
  goal: "Add user authentication",
});
```

### 2. Use Session IDs for Continuity

```typescript
// Maintain conversation across requests
const sessionId = "user-123-session";

await fetch("/api/chat", {
  headers: { "X-Session-ID": sessionId },
  body: JSON.stringify({ message: "Create a user model" }),
});

await fetch("/api/chat", {
  headers: { "X-Session-ID": sessionId }, // Same session
  body: JSON.stringify({ message: "Now add validation" }),
});
```

### 3. Handle Timeouts for Long Workflows

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

try {
  const result = await runRLMWorkflow({
    goal: "Large refactoring task",
    workspace: "/path/to/project",
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeout);
}
```

### 4. Monitor Iteration Count

```typescript
actor.subscribe({
  next: snapshot => {
    const { iterationCount } = snapshot.context;

    // Warn on high iteration counts
    if (iterationCount > 15) {
      console.warn("High iteration count - possible doom loop");
    }

    // Force stop if needed
    if (iterationCount > 20) {
      actor.stop();
    }
  },
});
```

---

## Troubleshooting

### Issue: Agent not responding

**Solution**: Check workspace directory exists and is accessible.

```typescript
import { existsSync } from "fs";
import { realpathSync } from "fs";

function validateWorkspace(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Workspace does not exist: ${path}`);
  }
  const resolved = realpathSync(path);
  console.log("Workspace validated:", resolved);
}
```

### Issue: Tools not available

**Solution**: Ensure tools are properly imported and registered.

```typescript
// Verify tool exports
import { TOOL_REGISTRY } from "@ekacode/core/tools";
console.log("Available tools:", Object.keys(TOOL_REGISTRY));
```

### Issue: Session not persisting

**Solution**: Verify database connection and session ID format.

```bash
# Check database migrations
pnpm --filter @ekacode/server drizzle:push

# Verify session table
sqlite3 data/libsql.db "SELECT * FROM sessions LIMIT 5;"
```

---

## Additional Resources

- [XState Documentation](https://xstate.js.org/docs/)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Project README](../README.md)
- [Architecture Overview](./architecture.md)
