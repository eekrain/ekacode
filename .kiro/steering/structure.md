# Project Structure

## Organization Philosophy

**Layered Monorepo**: Separation between apps (deliverables) and packages (shared logic).

- `apps/`: End-user applications (desktop, electron, preload)
- `packages/`: Shared libraries consumed by apps
- `docs/`: Architecture notes and implementation plans
- `scripts/`: Repository-level automation

## Directory Patterns

### Applications (`apps/`)

**Desktop UI** (`apps/desktop/`)

```
src/
├── views/           # Page-level components (routes)
├── core/            # Business logic, state, services
│   ├── state/       # Stores, providers, contexts
│   ├── services/    # API clients, SSE, utilities
│   └── chat/        # Chat-specific hooks and services
└── components/      # Shared UI components
```

**Electron Process** (`apps/electron/`)

- Main process entry point
- IPC handlers
- Window management

**Preload** (`apps/preload/`)

- Context bridge definitions
- Secure IPC exposure

### Packages (`packages/`)

**Core** (`packages/core/`)

```
src/
├── chat/            # Chat contracts and types
├── server/          # Server-side contracts
├── tools/           # AI tool definitions
├── memory/         # Memory/persistence abstractions
└── spec/           # Specification parsing
```

**Server** (`packages/server/`)

```
src/
├── routes/         # Hono route handlers
├── provider/       # LLM provider abstractions
├── middleware/     # Express middleware
├── state/          # In-memory state
├── bus/            # Event bus
└── services/       # Business services
```

**Shared** (`packages/shared/`)

- Cross-package utilities
- Common types and constants

### Tests

Tests colocated in `__tests__` directories next to source:

```
services/
├── api-client.ts
└── __tests__/
    └── api-client.test.ts
```

## Naming Conventions

- **Files**: kebab-case (`new-workspace-dialog.tsx`, `session-store.ts`)
- **Components**: PascalCase (`NewWorkspaceDialog`, `SessionStore`)
- **Functions/Hooks**: camelCase (`useChat`, `useMessages`, `getSession`)
- **Constants**: UPPER_SNAKE_CASE for true constants, PascalCase for enum-like values

## Import Organization

```typescript
// Workspace packages
import { Something } from "@sakti-code/core";
import { utility } from "@sakti-code/shared";

// Relative for local
import { LocalComponent } from "./components/local-component";

// Path aliases (configured per package)
import { aliased } from "@/path/to/module";
```

**Path Aliases**: Configured per-package (e.g., `@/` maps to package root in desktop tests)

## Code Organization Principles

1. **Colocation**: Keep tests near source in `__tests__/`
2. **Barrel Files**: Use `index.ts` for public exports
3. **Single Responsibility**: One topic per file
4. **Explicit Over Implicit**: Named exports preferred
5. **Deep Relative Avoidance**: Use path aliases, avoid `../../../../`

---

_Document patterns, not file trees. New files following patterns shouldn't require updates_
