# Instance Context System Specification

**Status**: Implementation
**Roadmap Item**: #2 - Build core Instance context system
**Created**: 2025-01-29

## Overview

Replace the singleton `WorkspaceInstance` pattern with AsyncLocalStorage-based context propagation. This enables automatic directory context propagation through async call stacks, per-instance state management, and workspace detection.

**Current State**: `WorkspaceInstance.getInstance()` is deprecated. Use `Instance.provide({ directory, fn })`. Tools now access context via `Instance.context` (not `experimental_context`).
**Target State**: AsyncLocalStorage-based `Instance.provide()` pattern with automatic context propagation

## Architecture

```
HTTP Request → sessionBridge (UUIDv7 session) → Instance.provide()
                                                       ↓
                                              AsyncLocalStorage
                                              InstanceContext
                                                       ↓
                                            AI Agent (Mastra)
                                                       ↓
                                              Tools (auto context)
```

## Key Design Principles

1. **Async Context Propagation**: Node.js `AsyncLocalStorage` for automatic context through async call stacks
2. **Dependency Injection**: `Instance.provide()` pattern for explicit context boundaries
3. **State Isolation**: Per-instance state with session-based separation
4. **Workspace Detection**: Automatic project root detection from any file path
5. **Backward Compatibility**: Gradual migration from singleton pattern

## Type Definitions

### InstanceContext

The core context object that propagates through async call stacks.

```typescript
interface InstanceContext {
  // The working directory for this instance
  directory: string

  // UUIDv7 session identifier
  sessionID: string

  // UUIDv7 message identifier (unique per request)
  messageID: string

  // Detected project information (populated by bootstrap)
  project?: ProjectInfo

  // Version control system information (populated by bootstrap)
  vcs?: VCSInfo

  // Context creation timestamp
  createdAt: number

  // Optional agent identifier
  agent?: string

  // Optional abort signal for cancellation
  abort?: AbortSignal
}
```

### ProjectInfo

Information about the detected project/workspace.

```typescript
interface ProjectInfo {
  // Project name (from package.json, detected, or directory name)
  name: string

  // Project root directory (absolute path)
  root: string

  // Git worktree path if applicable
  worktree?: string

  // Parsed package.json if present
  packageJson?: Record<string, unknown>
}
```

### VCSInfo

Version control system information.

```typescript
interface VCSInfo {
  // Type of version control system
  type: "git" | "hg" | "svn" | "none"

  // Current branch name
  branch?: string

  // Current commit SHA
  commit?: string

  // Remote URL (e.g., git@github.com:user/repo.git)
  remote?: string
}
```

## Public API

### Instance

The main entry point for context management.

```typescript
const Instance = {
  // Establish context boundary and execute function
  async provide<R>(input: {
    directory: string              // Working directory
    fn: () => Promise<R>            // Function to execute within context
    init?: (context: InstanceContext) => Promise<void>  // Optional init hook
  }): Promise<R>

  // Access current context (throws if outside provide())
  get directory(): string
  get project(): ProjectInfo | undefined
  get vcs(): VCSInfo | undefined
  get inContext(): boolean
  get context(): InstanceContext

  // State management
  state: {
    get<K>(key: string): K | undefined
    set<K>(key: string, value: K): void
    clear(): void
  }

  // Bootstrap project detection
  async bootstrap(context: InstanceContext): Promise<void>
}
```

## Usage Examples

### Basic Usage

```typescript
import { Instance } from "@ekacode/core"

// Establish context and execute
await Instance.provide({
  directory: "/path/to/project",
  async fn() {
    // Context is automatically available here
    const dir = Instance.directory  // "/path/to/project"
    const project = Instance.project

    // Any async operations preserve context
    await readFile("src/index.ts")  // Resolves to /path/to/project/src/index.ts
  }
})
```

### Nested Context

```typescript
// Outer context
await Instance.provide({
  directory: "/project",
  async fn() {
    console.log(Instance.directory)  // "/project"

    // Inner context with same directory reuses context
    await Instance.provide({
      directory: "/project",
      async fn() {
        console.log(Instance.directory)  // "/project" (same context)
      }
    })

    // Different directory creates new context
    await Instance.provide({
      directory: "/other",
      async fn() {
        console.log(Instance.directory)  // "/other" (new context)
      }
    })
  }
})
```

### Server Integration

```typescript
// In session bridge middleware
export async function sessionBridge(c: Context, next: Next) {
  const session = await getOrCreateSession(c)
  const workspace = detectWorkspaceFromRequest(c)

  await Instance.provide({
    directory: workspace,
    async fn() {
      // Set session in context for tools to access
      c.set("session", session)
      c.set("instanceContext", Instance.getContext())

      // All downstream code has access to Instance
      await next()
    }
  })
}
```

### Tool Usage

```typescript
// Tools can access context without explicit parameters
export const readTool = tool({
  execute: async ({ filePath }, options) => {
    // Context is automatically available
    const { directory, sessionID } = Instance.getContext()

    // Resolve path relative to context directory
    const absolutePath = path.resolve(directory, filePath)

    // Use sessionID for permission checks
    const approved = await permissionMgr.requestApproval({
      sessionID,
      permission: "read",
      patterns: [absolutePath]
    })

    // ... rest of implementation
  }
})
```

### State Management

```typescript
await Instance.provide({
  directory: "/project",
  async fn() {
    // Store state (persists across provide calls with same directory)
    Instance.state.set("cacheKey", expensiveResult)

    // Retrieve state
    const cached = Instance.state.get("cacheKey")

    // Clear state
    Instance.state.clear()
  }
})
```

## Migration Guide

### From WorkspaceInstance

**Old Pattern**:
```typescript
const workspace = WorkspaceInstance.getInstance()
const path = workspace.getRelativePath(filePath)
```

**New Pattern**:
```typescript
const { directory } = Instance.context
const relativePath = path.relative(directory, filePath)
```

### From experimental_context

**Old Pattern**:
```typescript
const sessionID = options.experimental_context?.sessionID || uuidv7()
```

**New Pattern**:
```typescript
const { sessionID } = Instance.context
```

## Implementation Status

- [x] Spec documentation
- [x] Context store (context.ts)
- [x] Instance API (index.ts)
- [x] State management (state.ts)
- [x] Bootstrap system (bootstrap.ts)
- [x] Project detection (project.ts)
- [x] VCS integration (vcs.ts)
- [x] Tool migration
- [x] Server integration
- [x] Deprecation of WorkspaceInstance

## Error Handling

### Context Access Outside provide()

```typescript
// Outside of Instance.provide()
const dir = Instance.directory
// Throws: Instance context accessed outside of Instance.provide().
// Tools must be called within Instance.provide({ directory, fn })
```

### Graceful Context Check

```typescript
if (Instance.inContext) {
  // Safe to access Instance.directory
} else {
  // Handle missing context
}
```

## Testing Strategy

### Unit Tests

- Context propagation through async/await
- Context isolation between concurrent operations
- Nested provide() behavior
- State persistence and isolation
- Workspace detection for various project types

### Integration Tests

- Session bridge establishes context
- Tools receive workspace context
- Session isolation between requests
- Permission manager integration

## Performance Considerations

- **AsyncLocalStorage overhead**: Minimal (< 1μs per access)
- **State storage**: In-memory Map with O(1) lookups
- **Project detection**: Cached per directory, only runs once
- **VCS commands**: Cached in state, TTL-based eviction

## Security Considerations

- SessionID included in all permission requests
- Context isolation prevents cross-session leakage
- Directory validation prevents path traversal
- Abort signal supports request cancellation
