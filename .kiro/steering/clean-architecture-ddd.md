# Clean Architecture & Domain-Driven Design

This steering document establishes architectural patterns that make code comprehensible, maintainable, and aligned with Domain-Driven Design (DDD) principles.

## Core Principles

### 1. Bounded Contexts (Package-Level)

Each package represents a bounded context with clear responsibilities:

```
packages/
├── core/       # Shared domain logic, chat/server contracts
├── server/     # Backend services, DB schema
├── shared/     # Cross-cutting utilities
├── zai/        # AI provider integrations
└── memorable-name/
```

**Rule**: A package should have one primary reason to change. If you need to explain what a package does in multiple sentences, it's too large.

### 2. Module Organization (Inside Packages)

Each module follows a consistent structure:

```
src/
├── feature-name/
│   ├── index.ts          # Public API exports
│   ├── types.ts          # Domain types & interfaces
│   ├── service.ts        # Business logic (entities, use cases)
│   ├── storage.ts        # Data access layer
│   ├── events.ts        # Domain events
│   └── __tests__/       # Co-located tests
```

**Example** (`packages/core/src/memory/`):

```
memory/
├── index.ts          # Exports taskStorage, messageStorage, query/mutate functions
├── task/
│   ├── storage.ts    # Task-specific DB operations
│   ├── task-query.ts # Query use cases
│   └── task-mutate.ts# Mutation use cases
└── reflection/
    ├── storage.ts
    └── reflector.ts
```

### 3. Layered Architecture Within Modules

Each feature module implements clean layers:

```
┌─────────────────────────────────────┐
│  Presentation/Export (index.ts)    │  ← Public API
├─────────────────────────────────────┤
│  Use Cases (service.ts, *-mutate.ts)│  ← Business logic
├─────────────────────────────────────┤
│  Domain Types (types.ts)            │  ← Entities, value objects
├─────────────────────────────────────┤
│  Infrastructure (storage.ts)       │  ← DB, external services
└─────────────────────────────────────┘
```

### 4. Dependency Rule

Dependencies flow inward only. Inner layers never import from outer layers.

```typescript
// ✅ Correct: Service imports types
import { Task, CreateTaskInput } from "./types";

// ❌ Wrong: Service imports storage directly for business logic
import { taskStorage } from "./storage"; // Only for infrastructure!

// ✅ Correct: Use cases orchestrate via service layer
async function createTask(input: CreateTaskInput): Promise<Task> {
  const task = new Task(input); // Domain logic
  return taskStorage.create(task); // Infrastructure call
}
```

## Naming Conventions

### Files

- `PascalCase` for components, classes, types
- `kebab-case` for utilities, configs
- `*-query.ts` / `*-mutate.ts` for use case operations

### Functions

- **Queries**: `execute*Query`, `get*`, `list*`, `search*`
- **Commands**: `execute*Mutate`, `create*`, `update*`, `delete*`

### Exports (index.ts)

```typescript
// Named exports for main APIs
export { createTask, updateTask, deleteTask } from "./service";

// Re-export types
export type { Task, CreateTaskInput, TaskStatus } from "./types";

// Re-export storage for infrastructure needs
export { taskStorage } from "./storage";
```

## Domain Pattern Examples

### Entity Pattern

```typescript
// types.ts - Domain entity
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskStatus = "pending" | "in_progress" | "completed";

// service.ts - Entity operations
export function createTaskEntity(input: CreateTaskInput): Task {
  return {
    id: generateId(),
    title: input.title,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

### Repository Pattern

```typescript
// storage.ts - Repository interface
export interface TaskRepository {
  create(task: Task): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  findBySession(sessionId: string): Promise<Task[]>;
  update(id: string, data: Partial<Task>): Promise<Task>;
  delete(id: string): Promise<void>;
}

// Concrete implementation
export const taskStorage: TaskRepository = {
  create: (task) => db.task.create({ ... }),
  // ...
};
```

### Factory Pattern

```typescript
// factory.ts - Complex object creation
export function createAgent(config: AgentConfig): Agent {
  const agent = new HybridAgent({
    model: resolveModel(config.model),
    tools: loadTools(config.tools),
    hooks: initializeHooks(config.hooks),
  });

  return agent;
}
```

## Test Organization

Tests live next to the code they test:

```
src/
├── task/
│   ├── storage.ts
│   ├── __tests__/
│   │   ├── storage.test.ts      # Unit tests
│   │   └── storage-events.integration.test.ts
```

**Test naming**: `*.test.ts` for unit, `*.integration.test.ts` for integration.

## Cross-Cutting Concerns

### Shared Types

Put in `packages/shared/types/` or domain-specific `types/`:

- Enums used across packages
- Common interfaces
- Error types

### Infrastructure

Database, caches, external APIs:

- Live in `storage.ts` files
- Implement repository interfaces
- Are injected into use cases

### Events

Domain events in `events.ts`:

```typescript
export type TaskEvent =
  | { type: "task.created"; payload: Task }
  | { type: "task.updated"; payload: Task }
  | { type: "task.deleted"; payload: { id: string } };
```

## When to Create New Modules

Create a new module when:

- It has distinct business logic from existing modules
- It could be tested independently
- Other modules need to import it without circular dependencies

**Avoid**:

- Creating modules for single functions
- Grouping by file type (all "utils", all "helpers")
- Deep nesting (max 3 levels: `module/sub-module/component`)

## Legacy Patterns to Avoid

| Old Pattern                       | Preferred Pattern                          |
| --------------------------------- | ------------------------------------------ |
| `lib/utils.ts`                    | Feature modules with single responsibility |
| `types/global.ts`                 | Domain-specific types in relevant module   |
| Deep nesting (`a/b/c/d/e.ts`)     | Flat module structure                      |
| Barrel files exporting everything | Curated exports in `index.ts`              |

## Spec Integration

When creating specs for new features:

1. Identify the bounded context (existing or new package)
2. Define domain entities in `types.ts`
3. Implement use cases in `service.ts` or `*-mutate.ts`
4. Add infrastructure in `storage.ts`
5. Export public API in `index.ts`

This ensures specs produce code that follows DDD principles and remains comprehensible as the project grows.
