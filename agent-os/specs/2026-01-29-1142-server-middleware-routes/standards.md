# Standards: Server Middleware + Core Routes

**Spec ID**: `2026-01-29-1142-server-middleware-routes`

## Applicable Standards

### From `agent-os/standards/global/code-quality.md`

1. **TypeScript and ESLint Error Resolution**
   - ALL TypeScript and ESLint errors MUST be fixed before committing
   - No `any` types without justification
   - Explicit return types on all exported functions
   - Prefix intentionally unused variables with `_`

2. **Test Layout**
   - All test files live under `packages/*/tests`
   - Test files: `<name>.test.ts` or `<name>.spec.ts`
   - Update imports when moving tests

3. **App Path Resolution**
   - Use absolute paths for database URLs
   - Use `resolveAppPaths()` from shared

4. **UIMessage Stream Compliance**
   - All streaming responses use AI SDK UIMessage protocol
   - Emit JSON parts: `text-delta`, `tool-call`, `data-*`, `finish`
   - Set header: `x-vercel-ai-ui-message-stream: v1`

5. **Clean Code Principles**
   - Meaningful names (pronounceable, searchable)
   - Small, focused functions (one responsibility)
   - Early returns over deep nesting
   - Specific error handling (no silent catches)
   - Self-documenting code (comments explain WHY)

### From `agent-os/standards/global/tech-stack.md`

1. **Hono (HTTP API Gateway)**
   - Latest version with Node adapter
   - Native streaming (SSE helpers)
   - Fetch/Request/Response-native APIs

2. **Vercel AI SDK v6**
   - UIMessage stream protocol
   - `createUIMessageStream` and `createUIMessageStreamResponse`
   - Custom `data-*` parts

3. **Zod (Validation)**
   - Runtime schema validation for API contracts
   - Type inference from schemas

## Implementation Standards

### File Organization

```
packages/server/src/
├── middleware/
│   ├── cors.ts           (existing)
│   ├── logging.ts        (existing - inline)
│   ├── auth.ts           (NEW - Basic Auth)
│   ├── session-bridge.ts (existing)
│   └── error-handler.ts  (NEW - error handling)
├── routes/
│   ├── chat.ts           (existing)
│   ├── permissions.ts    (existing)
│   ├── events.ts         (existing)
│   ├── rules.ts          (existing)
│   ├── health.ts         (NEW)
│   └── prompt.ts         (NEW)
├── db/                   (existing)
├── index.ts              (UPDATE)
└── types.ts              (NEW - shared types)
```

### Naming Conventions

- Files: kebab-case (`error-handler.ts`, `health.ts`)
- Functions: camelCase (`validateCredentials`, `handleError`)
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_USERNAME`, `AUTH_HEADER`)
- Types: PascalCase (`ErrorResponse`, `HealthResponse`)

### Error Handling Standards

```typescript
// ✅ GOOD - Specific error handling
try {
  await operation();
} catch (error) {
  if (error instanceof NetworkError) {
    logger.warn("Network failed", { url });
    return retry();
  }
  throw error; // re-throw unexpected errors
}

// ❌ BAD - Generic catch
try {
  await operation();
} catch (e) {
  console.log(e); // silent failure
}
```

### Middleware Pattern

```typescript
// Standard middleware signature
export async function middlewareName(
  c: Context<Env>,
  next: Next
): Promise<Response | void> {
  // 1. Extract request info
  const requestId = c.get("requestId");

  // 2. Perform logic
  const result = await validateSomething();

  // 3. On failure, return early
  if (!result) {
    return c.json({ error: "..." }, 400);
  }

  // 4. Set context if needed
  c.set("key", value);

  // 5. Continue chain
  await next();
}
```

### Route Handler Pattern

```typescript
// Standard route handler
app.get("/route", async c => {
  const requestId = c.get("requestId");

  try {
    // Validate input
    const input = await validateRequest(c.req.json());

    // Execute logic
    const result = await handler(input);

    // Return response
    return c.json(result);
  } catch (error) {
    // Let error handler middleware catch
    throw error;
  }
});
```

### Logging Standards

```typescript
// Use Pino logger from @ekacode/shared/logger
import { createLogger } from "@ekacode/shared/logger";

const logger = createLogger("server:module-name");

// Structured logging with context
logger.info("Event description", {
  module: "auth",
  requestId,
  userId,
  action: "login_attempt",
});

// Error logging with context
logger.error("Error description", {
  module: "database",
  requestId,
  error: error.message,
  stack: error.stack,
});
```

### Environment Variables

```typescript
// Read from process.env with defaults
const USERNAME = process.env.EKACODE_USERNAME || "admin";
const PASSWORD = process.env.EKACODE_PASSWORD || "changeme";

// Validate required vars at startup
function validateEnv() {
  const required = ["EKACODE_USERNAME", "EKACODE_PASSWORD"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}
```

### Type Safety Standards

```typescript
// ✅ GOOD - Explicit return types
function validateCredentials(
  header: string | null
): { username: string; password: string } | null {
  // ...
  return { username, password };
}

// ❌ BAD - Implicit return type
function validateCredentials(header: string | null) {
  // ...
  return { username, password };
}

// ✅ GOOD - Type guards
function isValidationError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}

// ✅ GOOD - Discriminated unions
type AuthResult =
  | { success: true; credentials: Credentials }
  | { success: false; reason: string };
```

### Testing Standards

```typescript
// Test structure
import { describe, it, expect, beforeEach } from "vitest";

describe("Auth Middleware", () => {
  beforeEach(async () => {
    // Setup: clear database, reset env vars
  });

  it("should return 401 for missing credentials", async () => {
    const res = await app.request("/api/chat");
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 200 for valid credentials", async () => {
    const res = await app.request("/api/chat", {
      headers: {
        Authorization: `Basic ${btoa("admin:changeme")}`,
      },
    });
    expect(res.status).toBe(200);
  });
});
```

## Security Standards

1. **No secrets in logs** - Never log passwords, tokens, or request bodies with sensitive data
2. **Validate all input** - Use Zod schemas for request bodies
3. **Sanitize error messages** - Don't leak implementation details in 500 responses
4. **Use prepared statements** - For database queries (Drizzle handles this)
5. **Rate limiting** - Consider adding for production (future enhancement)

## Performance Standards

1. **Fast health checks** - `/health` should respond in <10ms
2. **Minimal middleware overhead** - Keep middleware logic simple
3. **Stream responses** - Use UIMessage streaming for AI responses
4. **Connection pooling** - Reuse database connections (Drizzle handles this)

## Documentation Standards

1. **JSDoc for exports** - Document exported functions and types
2. **Inline comments** - Explain non-obvious logic
3. **README updates** - Document new endpoints and configuration
4. **CHANGELOG** - Record breaking changes

## Quality Checklist

Before marking a task complete:

- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] All tests pass
- [ ] New code follows naming conventions
- [ ] Error handling is specific and intentional
- [ ] Logs include requestId for tracing
- [ ] No sensitive data in error responses
- [ ] UIMessage streams use correct format
- [ ] Types are explicit (no `any` without justification)
- [ ] Tests cover happy path and error cases
