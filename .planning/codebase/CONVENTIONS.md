# Coding Conventions

**Analysis Date:** 2026-02-22

## Naming Patterns

**Files:**

- TypeScript files: `kebab-case.ts` (e.g., `event-types.ts`, `retry-handler.ts`)
- Component files: `PascalCase.tsx` (e.g., `Button.tsx`, `ChatPanel.tsx`)
- Test files: `*.test.ts`, `*.spec.ts`
- Config files: `kebab-case.config.ts`

**Functions:**

- camelCase (e.g., `getUser`, `createSession`, `streamResponse`)
- Use descriptive, verb-based names
- Prefix with underscore for unused parameters: `_event`

**Variables:**

- camelCase (e.g., `userId`, `isActive`, `chatSession`)
- Boolean: `is*`, `has*`, `can*` prefixes

**Types:**

- PascalCase (e.g., `User`, `ChatMessage`, `ToolDefinition`)
- Interfaces: `I*` not used (TypeScript best practice)
- Type aliases: Descriptive (e.g., `EventHandler`)

## Code Style

**Formatting:**

- Prettier 3.8.1
- Config: `.prettierrc`
- Plugins: prettier-plugin-organize-imports, prettier-plugin-tailwindcss
- Run: `pnpm format`

**Linting:**

- ESLint 9.39.2
- Config: `eslint.config.js`
- Rules: TypeScript recommended + custom rules
- Key rules:
  - `@typescript-eslint/no-unused-vars` - Error
  - `argsIgnorePattern: "^_"` - Allow unused args prefixed with `_`

## Import Organization

**Order:**

1. External libraries (react, solid-js, etc.)
2. Internal packages (@ekacode/\*)
3. Relative imports (../, ./)
4. Type imports

**Path Aliases:**

- Configured in `tsconfig.json`:
  - `@ekacode/core/chat` → `./packages/core/src/chat`
  - `@ekacode/core/server` → `./packages/core/src/server`
  - `@ekacode/core/tools` → `./packages/core/src/tools`
  - `@ekacode/server/bus` → `./packages/server/src/bus`
  - `@ekacode/server/db` → `./packages/server/db`

## Error Handling

**Patterns:**

- Zod for input validation
- Try-catch with typed error handling
- Result types (explicit success/error states)
- Error boundaries in UI components

## Logging

**Framework:** Pino 9.14.0

**Patterns:**

- Use structured JSON logging via Pino
- pino-pretty for development output
- Include context (userId, sessionId, etc.)
- Log levels: error, warn, info, debug

## Comments

**When to Comment:**

- Complex business logic
- Non-obvious workarounds
- TODO comments for technical debt
- API contracts

**JSDoc/TSDoc:**

- Use for public API documentation
- Include @param and @returns for functions

## Function Design

**Size:**

- Keep functions focused (< 50 lines ideal)
- Extract complex logic into helpers

**Parameters:**

- Use objects for 3+ parameters
- Use optional parameters with defaults

**Return Values:**

- Prefer explicit types over `any`
- Use void for side-effect-only functions

## Module Design

**Exports:**

- Named exports preferred
- Barrel files (index.ts) for clean imports

**Barrel Files:**

- Use in packages for clean public API
- Example: `packages/core/src/tools/index.ts` re-exports all tools

---

_Convention analysis: 2026-02-22_
