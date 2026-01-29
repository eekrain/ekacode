# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ekacode is a privacy-focused, offline-first AI coding agent that runs locally as an Electron application. It uses a monorepo architecture with 5 packages coordinated by pnpm workspaces and Turbo for build orchestration.

## Development Commands

### Root Commands (run from project root)

```bash
pnpm dev              # Start Electron desktop app in dev mode
pnpm build            # Build all packages with Turbo
pnpm test             # Run all tests across packages
pnpm lint             # Lint all packages
pnpm typecheck        # Typecheck all packages
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
```

### Package-Specific Commands

**Desktop (Electron + SolidJS):**

```bash
pnpm --filter @ekacode/desktop dev
pnpm --filter @ekacode/desktop build
pnpm --filter @ekacode/desktop typecheck
```

**Server (Hono API):**

```bash
pnpm --filter @ekacode/server test              # Run tests
pnpm --filter @ekacode/server test:run          # CI mode
pnpm --filter @ekacode/server test:coverage     # Coverage report
pnpm --filter @ekacode/server drizzle:generate  # Generate migrations
pnpm --filter @ekacode/server drizzle:push      # Push schema to DB
```

**Core (Agents, Tools, Security):**

```bash
pnpm --filter @ekacode/core test
pnpm --filter @ekacode/core test:run
pnpm --filter @ekacode/core test:coverage
```

### Single Test Execution

Use Vitest's `--testNamePattern` or `--testNamePattern` flag:

```bash
# Run a specific test file
pnpm --filter @ekacode/core test tests/agents/hybrid-agent/e2e.test.ts

# Run tests matching a pattern
pnpm --filter @ekacode/core test --testNamePattern "permission"
```

## Architecture

### Three-Tier Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Electron App (Desktop)                     │
│  Main Process ↔ Preload (Context Bridge) ↔ Renderer (SolidJS UI)   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ IPC
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Hono REST API (Server)                      │
│  Chat / Events / Permissions / Rules routes                        │
│  Session Bridge Middleware (UUIDv7 session management)              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
            ┌──────────┐ ┌──────────┐ ┌──────────┐
            │  libsql  │ │ Sessions │ │  Mastra  │
            │  (DB)    │ │   (DB)   │ │ Memory   │
            └──────────┘ └──────────┘ └──────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Core Logic (Core)                          │
│  Agents (Hybrid) │ Tools (FS, Shell, Search) │ Permissions         │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

**1. Monorepo Structure (pnpm workspaces)**

- All packages reference each other via `workspace:*` protocol
- Turbo orchestrates builds with caching and dependency ordering
- Packages: `@ekacode/desktop`, `@ekacode/server`, `@ekacode/core`, `@ekacode/shared`, `@ekacode/zai`

**2. IPC Communication (Electron)**

- Main → Preload → Renderer with context isolation
- Key IPC channels: `get-server-config`, `permission:response`, `fs:watch-*`
- Preload scripts expose safe APIs to renderer via context bridge

**3. Session Management**

- Session Bridge middleware manages sessions via `X-Session-ID` header
- UUIDv7 identifiers for time-ordered session IDs
- Database persistence in libsql (sessions table)
- Mastra memory integration for long-term context storage

**4. Permission System**

- Rule-based: `allow` > `deny` > `ask` (default)
- Configuration sources (priority order): env vars → `ekacode.config.json` → `package.json` → defaults
- Glob pattern matching for file paths
- Event-driven approval flow with 30s timeout
- Git tools are auto-allowed, all others require permission

**5. Tool System**

- Tools wrapped in `ai.tool()` for AI SDK integration
- Registry exports all available tools for agent access
- Permission checks on every tool execution
- Workspace validation ensures operations stay within allowed directories

**6. Workspace Management**

- Singleton `WorkspaceInstance` manages root directory and worktrees
- Path resolution with relative/absolute conversion
- External directory protection prevents escaping workspace

**7. Z.ai Provider Integration**

- Custom provider for Z.ai models (chat + vision)
- Hybrid Agent uses both text and vision models
- Integrated via AI SDK 6 with Mastra agent framework

### Data Flow Patterns

**Tool Execution:**

```
User Input → Tool Registry → AI Model → Tool Execute
  → Permission Check → Workspace Validation → FS Operation → Response
```

**Permission Request:**

```
Tool Request → PermissionManager → Rule Evaluation
  → (if ask) → Event Emission → Renderer IPC → User Response
    → handleResponse() → Cache Approval
```

**Session Handling:**

```
Request → Session Bridge (X-Session-ID header)
  → getSession/createSession → DB Persist → Context Set → Handler
```

## Code Organization

### Package Structure

```
packages/
├── core/                 # Core business logic
│   ├── agents/           # AI agents (Hybrid, Coder, Planner)
│   ├── tools/            # Filesystem, shell, search tools
│   ├── security/         # Permission system (PermissionManager)
│   ├── memory/           # Mastra memory integration
│   └── workspace/        # Workspace management
├── server/               # Hono REST API
│   ├── db/               # libsql database (sessions, tool_sessions)
│   ├── middleware/       # Session bridge, CORS
│   └── routes/           # Chat, permissions, events, rules
├── desktop/              # Electron app
│   └── src/
│       ├── main/         # Main process IPC handlers
│       ├── preload/      # Context bridge scripts
│       └── renderer/     # SolidJS UI components
├── shared/               # Shared types & utilities
│   ├── logger/           # Pino logger wrapper
│   ├── paths.ts          # App path resolution
│   └── types.ts          # Shared type definitions
└── zai/                  # Z.ai provider integration
    ├── chat/             # Chat API adaptations
    └── zai-provider.ts   # Provider factory
```

### Naming Conventions

- Packages: `@ekacode/<name>` (scoped npm packages)
- Files: kebab-case (`bash.tool.ts`, `session-bridge.ts`)
- Test files: `<name>.test.ts` or `<name>.spec.ts`
- Tests located in `tests/` directory within each package

## Technologies

**Frontend:** Electron 39, SolidJS 1.9, Electron Vite 5, Tailwind CSS 4
**Backend:** Hono 4.11, @hono/node-server, libsql, Drizzle ORM 0.45, Zod 4.3
**AI:** AI SDK 6, Mastra Core, Mastra Memory, @mastra/fastembed
**Tools:** Vitest 4, Pino 9, Turbo 2, UUID v7, diff 8, tree-sitter, Glob 13
**Runtime:** Node.js 22, pnpm 10

## Quality Tools

**ESLint:** `@typescript-eslint/eslint-plugin`, targets ES2022
**Prettier:** 2-space tabs, 100 char width, import organization plugins
**Pre-commit:** lint-staged runs eslint and prettier on staged files
**Test Framework:** Vitest with setup files for database initialization

## Database

**libsql (SQLite):**

- Tables: `sessions` (UUIDv7, thread_id, resource_id), `tool_sessions`
- Drizzle ORM with schema in `packages/server/db/`
- Migrations via `drizzle:generate` and `drizzle:push`

**Mastra Storage:**

- `ekacode-store` - Message storage
- `ekacode-vector` - Vector embeddings for semantic search

## Important Notes

- Privacy-focused: All operations are local-only by default
- Git tools are automatically allowed; all other tools require permission approval
- External directories are protected via workspace validation
- Electron app uses Wayland optimizations (via `--ozone-platform=wayland` flag)
- Session IDs use UUIDv7 for time-ordered, sortable identifiers
- The Hybrid Agent supports both text and vision capabilities via Z.ai provider
