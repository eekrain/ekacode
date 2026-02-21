# Architecture

**Analysis Date:** 2026-02-22

## Pattern Overview

**Overall:** Layered Monorepo with Domain-Driven Design

**Key Characteristics:**

- Monorepo with pnpm workspaces (apps/, packages/)
- Project references in TypeScript for incremental builds
- Clear separation between core logic, server, and UI
- AI-first architecture using Mastra and Vercel AI SDK

## Layers

**Core Layer (`packages/core`):**

- Purpose: AI agent orchestration, tools, memory, chat interfaces
- Location: `packages/core/src/`
- Contains: Agent definitions, chat sessions, tools, memory management, LSP integration
- Depends on: @ekacode/shared, @ekacode/zai, AI SDKs
- Used by: @ekacode/server, @ekacode/desktop

**Server Layer (`packages/server`):**

- Purpose: Backend API, database access, event bus
- Location: `packages/server/src/`
- Contains: HTTP endpoints (Hono), database schemas (Drizzle), event bus
- Depends on: @ekacode/core, @ekacode/shared, drizzle-orm
- Used by: Desktop app via IPC

**Shared Layer (`packages/shared`):**

- Purpose: Cross-package utilities
- Location: `packages/shared/src/`
- Contains: Event types, logging, retry logic, shutdown handling, persistence
- Depends on: pino, zod
- Used by: All packages

**Desktop App Layer (`apps/desktop`):**

- Purpose: Electron desktop application UI
- Location: `apps/desktop/src/`
- Contains: SolidJS components, providers, pages
- Depends on: @ekacode/shared, SolidJS ecosystem

**ZAI Layer (`packages/zai`):**

- Purpose: Custom AI abstractions over AI SDK
- Location: `packages/zai/src/`
- Contains: Custom provider implementations
- Depends on: @ai-sdk/provider

## Data Flow

**Chat Request Flow:**

1. Desktop app sends request via Electron IPC
2. Server receives via Hono endpoint
3. Core layer processes with AI agent
4. Agent uses tools, memory, session state
5. Response streamed back to client

**Database Access Flow:**

1. Server layer defines Drizzle schemas
2. Migrations managed via drizzle-kit
3. LibSQL client executes queries
4. Results validated with Zod schemas

## Key Abstractions

**Agent (`packages/core/src/agent/`):**

- Purpose: AI agent definitions and orchestration
- Examples: `packages/core/src/agent/index.ts`
- Pattern: State machines via xstate, AI SDK for LLM calls

**Chat (`packages/core/src/chat/`):**

- Purpose: Chat session management
- Examples: `packages/core/src/chat/index.ts`
- Pattern: Session-based conversations with memory

**Tools (`packages/core/src/tools/`):**

- Purpose: Reusable AI tool implementations
- Examples: `packages/core/src/tools/index.ts`
- Pattern: Tool definitions for AI agent use

**Memory (`packages/core/src/memory/`):**

- Purpose: Persistent memory for agents
- Examples: `packages/core/src/memory/`
- Pattern: Mastra memory integration

## Entry Points

**Server:**

- Location: `packages/server/src/index.ts`
- Triggers: Electron IPC or direct HTTP
- Responsibilities: Request handling, database access, event bus

**Desktop:**

- Location: `apps/desktop/src/main.ts` (Electron main)
- Triggers: User interaction
- Responsibilities: UI rendering, IPC to server

**Core:**

- Location: `packages/core/src/index.ts`
- Triggers: Server or direct imports
- Responsibilities: AI orchestration, tool execution

## Error Handling

**Strategy:** Result types and error propagation

**Patterns:**

- Zod validation for input/output schemas
- Try-catch blocks with typed errors
- Error boundaries in desktop UI
- Structured logging via Pino

## Cross-Cutting Concerns

**Logging:** Pino with pino-pretty for dev
**Validation:** Zod 4.x for schema validation
**Authentication:** API keys via environment variables

---

_Architecture analysis: 2026-02-22_
