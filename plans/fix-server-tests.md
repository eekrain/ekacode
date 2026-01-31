# Plan: Fix @ekacode/server Test Failures

## Summary

18 tests are failing across 3 test files:

- `chat.test.ts`: 11 failures (onnxruntime native module issue)
- `session-bridge.test.ts`: 6 failures (Instance context access issue)
- `events.test.ts`: 1 failure (event streaming timing issue)

---

## Issue 1: session-bridge.test.ts (6 failures)

### Root Cause

The test endpoint at line 58 accesses `Instance.directory` outside of `Instance.provide()` context:

```typescript
mockApp.get("/test", c => {
  const session = c.get("session");
  return c.json({
    hasSession: !!session,
    sessionId: session?.sessionId,
    directory: Instance.directory, // <-- ERROR: Outside Instance.provide()
  });
});
```

The `sessionBridge` middleware wraps `next()` in `Instance.provide()`, but the test handler runs AFTER `next()` completes, so the context is no longer available.

### Fix Strategy

Instead of accessing `Instance.directory` directly, read from the `instanceContext` that was set in the Hono context by the middleware:

```typescript
mockApp.get("/test", c => {
  const session = c.get("session");
  const instanceContext = c.get("instanceContext");
  return c.json({
    hasSession: !!session,
    sessionId: session?.sessionId,
    directory: instanceContext?.directory, // <-- Read from context
  });
});
```

### Additional Issues

1. **"should reject invalid session" expects 401 but gets 500**: The middleware returns 500 instead of 401 for invalid sessions. Need to fix error handling.
2. **"should emit data-session" test**: `response.ok` is false (500 error). Related to the Instance context issue.

---

## Issue 2: chat.test.ts (11 failures)

### Root Cause

All tests fail with:

```
Error: Module did not self-register: '.../onnxruntime_binding.node'
```

The RLM actor depends on native modules (onnxruntime-node) that cannot load properly in the test environment.

### Fix Strategy

Option A: Mock the RLM actor creation in tests
Option B: Skip chat integration tests in test environment (use `vi.skip` or conditional checks)
Option C: Mock the onnxruntime module at the vitest setup level

Recommended approach: Mock `@ekacode/core` to provide a stubbed `createRLMActor` that returns a mock actor.

---

## Issue 3: events.test.ts (1 failure)

### Root Cause

The test "streams permission events for matching session" times out waiting for the permission event.

```typescript
const eventChunk = await readWithTimeout(reader, 100);
expect(eventChunk).not.toBeNull(); // <-- FAILS: eventChunk is null
```

### Fix Strategy

The event emission might be happening before the listener is set up, or the timeout (100ms) is too short.

Options:

1. Increase timeout
2. Add small delay before emitting event
3. Use a synchronous event emission pattern in tests

---

## Implementation Order

1. **Fix session-bridge.test.ts first** - These are the clearest fixes
2. **Fix events.test.ts** - Single test, should be quick
3. **Fix chat.test.ts** - May require mocking strategy decision

---

## Files to Modify

1. `packages/server/tests/middleware/session-bridge.test.ts`
2. `packages/server/tests/routes/events.test.ts`
3. `packages/server/tests/routes/chat.test.ts` (or setup file)
4. `packages/server/tests/vitest.setup.ts` (if adding mocks)

---

## Typecheck and Lint Requirements

After every file change:

```bash
pnpm --filter @ekacode/server typecheck
pnpm --filter @ekacode/server lint
```

Final verification:

```bash
pnpm --filter @ekacode/server test
```
