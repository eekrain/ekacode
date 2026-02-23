# Technology Stack

## Architecture

**Monorepo Structure**: pnpm workspace managed by Turbo for parallel builds and shared caching.

- **Desktop Layer**: Electron + SolidJS for cross-platform desktop UI
- **Server Layer**: Hono-based backend services running locally
- **Shared Layer**: Core domain logic and AI contracts in shared packages

## Core Technologies

- **Language**: TypeScript (ESM modules)
- **Desktop Framework**: SolidJS 1.9+ with Vite
- **Backend Framework**: Hono 4.x
- **Runtime**: Node.js 20+
- **Package Manager**: pnpm 10.x
- **Build System**: Turbo 2.x

## Key Libraries

### Desktop (apps/desktop)

- **UI**: `@kobalte/core` (components), `tailwindcss` (styling), `@solidjs/router`
- **AI Integration**: `ai` SDK (`ai` package)
- **Icons**: `lucide-solid`
- **State**: SolidJS stores and context

### Server (packages/server)

- **HTTP**: Hono with `@hono/node-server`
- **Database**: Drizzle ORM + LibSQL (SQLite)
- **AI Runtime**: Mastra (`@mastra/core`, `@mastra/memory`)
- **Validation**: Zod

### Core (packages/core)

- **AI SDK**: `ai` package with multi-provider support (OpenAI, Anthropic, Google, etc.)
- **State Machines**: XState for complex state management
- **Code Analysis**: tree-sitter, ts-morph
- **VSE**: vscode-jsonrpc, vscode-languageserver-types

## Development Standards

### Type Safety

- TypeScript strict mode enabled
- No `any` types in production code
- Strict null checks

### Code Quality

- ESLint with `@typescript-eslint`
- Prettier with organize-imports plugin
- Path aliases configured (e.g., `@/` in desktop tests)

### Testing

- **Framework**: Vitest
- **Desktop Projects**:
  - `desktop-unit-node`: Node.js unit tests
  - `desktop-ui-jsdom`: UI component tests (jsdom)
  - `desktop-contract`: Integration/contract tests
- Tests colocated in `__tests__` directories
- Naming: `*.test.ts`, `*.test.tsx`

## Development Environment

### Required Tools

- Node.js 20+
- pnpm 10.x
- TypeScript 5.x

### Common Commands

```bash
# Install dependencies
pnpm install

# Development (orchestrates all packages)
pnpm dev
pnpm dev:p  # parallel mode

# Build
pnpm build

# Test
pnpm test           # all packages
pnpm test:ui        # desktop UI tests
pnpm test:unit      # desktop unit tests

# Lint & Format
pnpm lint
pnpm format

# Type check
pnpm typecheck
```

## Key Technical Decisions

1. **Electron + SolidJS**: Chosen for reactive UI with native desktop capabilities
2. **Local-First Database**: LibSQL (SQLite) for offline-first data persistence
3. **Mastra Integration**: Provides AI agent runtime with memory management
4. **Multi-Provider Architecture**: Abstraction layer supports OpenAI, Anthropic, Google, and custom providers
5. **Permission-Gated Actions**: All file system operations require explicit user approval

---

_Document standards and patterns, not every dependency_
