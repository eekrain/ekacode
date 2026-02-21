# Testing Patterns

**Analysis Date:** 2026-02-22

## Test Framework

**Runner:**

- Vitest 4.0.18
- Config: `vitest.config.ts` (per package)

**Assertion Library:**

- Vitest built-in ( Chai assertions)

**Run Commands:**

```bash
pnpm test              # Run all tests
pnpm test:watch       # Watch mode (zai package)
vitest run            # Run once (core/server)
vitest run --coverage # With coverage
```

## Test File Organization

**Location:**

- Co-located with source files
- Same directory as implementation

**Naming:**

- `*.test.ts` - Unit tests
- `*.spec.ts` - Integration tests (convention, functionally equivalent)

**Structure:**

```
packages/core/src/agent/
├── agent.ts
├── agent.test.ts      # Unit tests
└── agent.spec.ts      # Integration tests
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Agent", () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent();
  });

  it("should create agent with default config", () => {
    expect(agent).toBeDefined();
  });

  it("should handle chat message", async () => {
    const response = await agent.chat("Hello");
    expect(response).toBeDefined();
  });
});
```

**Patterns:**

- beforeEach for setup/reset
- describe blocks for grouping
- it/test for individual cases
- expect for assertions

## Mocking

**Framework:** Vitest built-in (vi)

**Patterns:**

```typescript
import { vi } from "vitest";

// Mock functions
const mockFn = vi.fn(() => "mocked");

// Mock modules
vi.mock("some-module", () => ({
  default: vi.fn(),
}));

// Mock timers
vi.useFakeTimers();

// Restore
vi.restoreAllMocks();
```

**What to Mock:**

- External APIs (AI providers)
- File system operations
- Database calls (in unit tests)
- Time-dependent code (use fake timers)

**What NOT to Mock:**

- Simple utility functions
- Internal logic that should be tested
- Database in integration tests

## Fixtures and Factories

**Test Data:**

```typescript
// fixtures/users.ts
export const testUser = {
  id: "test-user-1",
  name: "Test User",
  email: "test@example.com",
};

export const createMockUser = (overrides = {}) => ({
  ...testUser,
  ...overrides,
});
```

**Location:**

- Co-located with test files: `__fixtures__/` or `fixtures/`
- Or in `tests/` directory at package root

## Coverage

**Requirements:** None currently enforced

**View Coverage:**

```bash
pnpm test:coverage   # In packages with coverage script
# Outputs to coverage/ directory
```

## Test Types

**Unit Tests:**

- Focus: Individual functions, classes
- Mock: External dependencies
- Location: `*.test.ts`

**Integration Tests:**

- Focus: Module interactions
- Mock: Minimal (real database where appropriate)
- Location: `*.spec.ts`

**E2E Tests:**

- Not currently configured in this monorepo
- Would Playwright if use added

## Common Patterns

**Async Testing:**

```typescript
it("should resolve promise", async () => {
  const result = await asyncFunction();
  expect(result).toBe("expected");
});

it("should handle rejection", async () => {
  await expect(asyncFunction()).rejects.toThrow("error");
});
```

**Error Testing:**

```typescript
it("should throw on invalid input", () => {
  expect(() => validate("invalid")).toThrow();
});
```

---

_Testing analysis: 2026-02-22_
