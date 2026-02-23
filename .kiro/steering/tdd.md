# Test-Driven Development (TDD)

## Philosophy

This project follows strict TDD practices. The core principle: **if you didn't watch the test fail, you don't know if it tests the right thing.**

> **Iron Law**: No production code without a failing test first.

## The Red-Green-Refactor Cycle

Every feature, bug fix, or behavior change follows this cycle:

### 1. RED - Write Failing Test

Write one minimal test demonstrating the desired behavior:

```typescript
describe("SkillManager", () => {
  describe("getSkill", () => {
    it("should return skill by name", () => {
      const manager = new SkillManager(mockSkills);
      const skill = manager.getSkill("test-skill");
      expect(skill).toBeDefined();
      expect(skill?.name).toBe("test-skill");
    });
  });
});
```

**Requirements:**

- One behavior per test
- Clear, descriptive name (describe expected behavior)
- Test real behavior, not implementation
- No mocks unless absolutely necessary

### 2. Verify RED - Watch It Fail (MANDATORY)

```bash
pnpm test path/to/test.test.ts
```

Confirm:

- Test fails (not errors)
- Failure message reflects missing feature
- Fails because feature doesn't exist, not typos

**Never skip this step.** If test passes immediately, you're testing existing behavior.

### 3. GREEN - Minimal Code

Write the simplest code to pass the test:

```typescript
getSkill(name: string): SkillInfo | undefined {
  return this.skills.find(s => s.name === name);
}
```

**Don't:**

- Add features beyond the test
- Refactor other code
- Over-engineer with options/parameters you'll need "later"

### 4. Verify GREEN - Watch It Pass (MANDATORY)

```bash
pnpm test path/to/test.test.ts
```

Confirm:

- Test passes
- All other tests still pass
- No errors or warnings

### 5. REFACTOR - Clean Up

Only after green:

- Remove duplication
- Improve names
- Extract helpers
- Keep all tests green

### Repeat

Next failing test for the next piece of functionality.

## Project Test Organization

### Location

Co-located tests next to source files:

```
src/session/
├── processor.ts
├── processor.test.ts      # unit tests
├── processor.integration.test.ts  # integration tests
└── __tests__/
    └── helpers.ts        # test utilities
```

### Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `/tests/e2e/*.test.ts`

### Structure (AAA Pattern)

```typescript
it("does X when Y", () => {
  // Arrange
  const input = setup();

  // Act
  const result = act(input);

  // Assert
  expect(result).toEqual(expected);
});
```

## Test Types in This Project

### Unit Tests

- Single function/class in isolation
- Mock external dependencies
- Very fast execution
- Located: co-located with source

### Integration Tests

- Multiple units working together
- Mock only externals (APIs, databases)
- Located: `*.integration.test.ts` or `/tests/integration/`

### E2E Tests

- Full user flows
- Minimal mocks
- Critical journeys only
- Located: `/tests/e2e/`

## Testing Framework

- **Framework**: Vitest
- **Run tests**: `pnpm test` (workspace-wide)
- **Run specific**: `pnpm --filter @sakti-code/core test`

## Mocking Guidelines

- **Mock externals**: APIs, databases, file system
- **Never mock the system under test**
- Use factories/fixtures for test data
- Reset state between tests

## What to Test

### Always Test

- New features
- Bug fixes (reproduce the bug first)
- Edge cases
- Error handling paths

### Test Names

- Describe expected behavior: `it("rejects empty email")`
- Avoid: `it("test1")`, `it("should work")`

## Common Rationalizations to Avoid

| Excuse                      | Reality                                           |
| --------------------------- | ------------------------------------------------- |
| "Too simple to test"        | Simple code breaks. Test takes 30 seconds.        |
| "I'll test after"           | Tests passing immediately prove nothing.          |
| "Already manually tested"   | Ad-hoc isn't systematic. No record, can't re-run. |
| "Deleting work is wasteful" | Sunk cost. Keeping unverified code is debt.       |

## Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)

---

_See also: `@test-driven-development` skill for detailed TDD guidance._
