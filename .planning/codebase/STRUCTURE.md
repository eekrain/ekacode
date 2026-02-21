# Codebase Structure

**Analysis Date:** 2026-02-22

## Directory Layout

```
ekacode/
├── apps/                      # Applications
│   ├── desktop/             # Electron desktop app
│   ├── electron/            # Electron main process
│   └── preload/             # Electron preload scripts
├── packages/                 # Shared packages
│   ├── core/                # AI agent core
│   ├── server/              # Backend server
│   ├── shared/              # Shared utilities
│   ├── zai/                 # Custom AI abstractions
│   └── memorable-name/      # Utility package
├── .opencode/               # Opencode configuration
│   ├── agents/              # Custom GSD agents
│   ├── command/             # Custom GSD commands
│   ├── get-shit-done/       # GSD workflow system
│   └── hooks/               # Opencode hooks
├── scripts/                 # Build/maintenance scripts
├── .github/                 # GitHub Actions
├── docs/                    # Documentation
└── .planning/               # Planning artifacts
    └── codebase/           # Codebase maps (this folder)
```

## Directory Purposes

**apps/desktop:**

- Purpose: Electron-based desktop application
- Contains: SolidJS UI components, pages, providers
- Key files: `apps/desktop/src/main.ts`, `apps/desktop/src/App.tsx`

**packages/core:**

- Purpose: AI agent orchestration and tooling
- Contains: Agent, chat, memory, tools, session, workspace, LSP
- Key files: `packages/core/src/index.ts`, `packages/core/src/agent/`

**packages/server:**

- Purpose: Backend HTTP server and database
- Contains: HTTP routes (Hono), Drizzle schemas, event bus
- Key files: `packages/server/src/index.ts`, `packages/server/db/`

**packages/shared:**

- Purpose: Cross-cutting utilities
- Contains: Event types, logging, retry, shutdown, persistence
- Key files: `packages/shared/src/index.ts`, `packages/shared/src/logger/`

**packages/zai:**

- Purpose: Custom AI SDK abstractions
- Contains: Custom provider implementations
- Key files: `packages/zai/src/index.ts`

## Key File Locations

**Entry Points:**

- Server: `packages/server/src/index.ts` - Hono app initialization
- Desktop: `apps/desktop/src/main.ts` - Electron main process

**Configuration:**

- Root: `package.json`, `tsconfig.json`, `turbo.json`
- Linting: `eslint.config.js`
- Formatting: `.prettierrc`, `.prettierignore`
- Monorepo: `pnpm-workspace.yaml`

**Core Logic:**

- AI agents: `packages/core/src/agent/`
- Chat: `packages/core/src/chat/`
- Tools: `packages/core/src/tools/`
- Memory: `packages/core/src/memory/`

**Testing:**

- Config: `vitest.config.ts` (in each package)
- Tests: Co-located with source (`*.test.ts`, `*.spec.ts`)

## Naming Conventions

**Files:**

- TypeScript: `kebab-case.ts`, `kebab-case.test.ts`
- React/Solid: `PascalCase.tsx`
- Config: `kebab-case.config.ts`

**Directories:**

- General: `kebab-case/`
- Components: `PascalCase/`

**Packages:**

- Scope: `@ekacode/`
- Name: `kebab-case` (e.g., `@ekacode/core`)

## Where to Add New Code

**New Feature:**

- Backend: `packages/core/src/` or `packages/server/src/`
- Frontend: `apps/desktop/src/`
- Tests: Co-located with implementation

**New Package:**

- Add to `packages/` directory
- Add to `pnpm-workspace.yaml`
- Add to root `tsconfig.json` references

**New Tool (AI):**

- Implement in `packages/core/src/tools/`
- Export from `packages/core/src/tools/index.ts`

**Utilities:**

- Shared: `packages/shared/src/`
- Package-specific: Within package `src/` folder

## Special Directories

**.opencode/:**

- Purpose: Custom opencode configuration and GSD agents
- Generated: No
- Committed: Yes

**.github/:**

- Purpose: GitHub Actions workflows
- Generated: No
- Committed: Yes

**node_modules/, .turbo/, dist/:**

- Generated: Yes
- Committed: No (gitignored)

---

_Structure analysis: 2026-02-22_
