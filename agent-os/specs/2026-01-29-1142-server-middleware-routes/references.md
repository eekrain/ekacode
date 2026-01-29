# References: Server Middleware + Core Routes

**Spec ID**: `2026-01-29-1142-server-middleware-routes`

## Source Documentation

### Planning Documents

1. **ROADMAP.md** - Task #4
   - File: `.claude/research/plans/ROADMAP.md`
   - Lines: Referenced as task #4
   - Content: "Add server middleware + core routes (directory context, auth, error handling, prompt + health endpoints, server wiring)"

2. **Architecture Plan** - Server Middleware Section
   - File: `.claude/research/plans/new-architecture-plan.md`
   - Lines: L730-L1203
   - Content: Detailed server architecture, middleware patterns, endpoint specifications

## Existing Code References

### Files to Modify

#### 1. `packages/server/src/index.ts`

**Current State**:
- Uses Bearer token authentication (`SERVER_TOKEN`)
- Has CORS middleware
- Has request logging middleware
- Routes: `/api/config`, `/system/status`, `/api/permissions`, `/api/chat`, `/`

**Changes Needed**:
- Remove Bearer token auth middleware
- Add Basic Auth middleware (new import)
- Add error handler middleware (new import)
- Mount `/health` route (before auth)
- Mount `/prompt` route
- Update `/api/config` to return `authType: "basic"`

**Key Code Snippet** (current auth):
```typescript
// Current - REMOVE THIS
app.use("/api/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith(`Bearer ${SERVER_TOKEN}`)) {
    logger.warn("Unauthorized access attempt", {
      module: "api:auth",
      requestId,
      authPresent: !!auth,
    });
    return c.json({ error: "Unauthorized" }, 401);
  }
  logger.debug("Request authenticated", { module: "api:auth", requestId });
  return next();
});
```

**New Pattern** (after changes):
```typescript
// NEW - Add this
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import healthRouter from "./routes/health";
import promptRouter from "./routes/prompt";

// Mount public routes first (no auth)
app.route("/", healthRouter);

// Add auth middleware (skips /health)
app.use("*", authMiddleware);

// Mount protected routes
app.route("/", promptRouter);
app.route("/api/chat", chatRouter);
// ... other routes

// Error handler (always last)
app.use("*", errorHandler);
```

#### 2. `packages/server/src/middleware/session-bridge.ts`

**Current State**: Fully implemented ✅

**Usage**: No changes needed, already integrates with Instance.provide()

**Key Pattern**:
```typescript
export async function sessionBridge(c: Context<Env>, next: Next): Promise<Response | void> {
  const sessionId = c.req.header("X-Session-ID");
  if (!sessionId) {
    const session = await createSession("local");
    c.set("session", session);
    // ... Instance.provide() integration
  }
  // ...
}
```

### Files to Create

#### 3. `packages/server/src/middleware/auth.ts` (NEW)

**Purpose**: Basic Authentication middleware

**Requirements**:
- Read credentials from `EKACODE_USERNAME` and `EKACODE_PASSWORD`
- Parse `Authorization: Basic <base64>` header
- Skip auth for `/health` endpoint
- Return 401 with `WWW-Authenticate` header on failure

**Pattern**:
```typescript
export async function authMiddleware(c: Context<Env>, next: Next): Promise<Response | void> {
  // Skip auth for health endpoint
  if (c.req.path === "/health") {
    return next();
  }

  // Validate Basic Auth
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing credentials", requestId: c.get("requestId") } },
      401
    );
  }

  // Verify credentials
  const credentials = parseBasicAuth(authHeader);
  if (!isValid(credentials)) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid credentials", requestId: c.get("requestId") } },
      401
    );
  }

  return next();
}
```

#### 4. `packages/server/src/middleware/error-handler.ts` (NEW)

**Purpose**: Centralized error handling

**Requirements**:
- Catch all errors in the chain
- Log errors with context (requestId, module, path)
- Return appropriate HTTP status codes
- Never leak sensitive data

**Pattern**:
```typescript
export async function errorHandler(c: Context<Env>, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (error) {
    const requestId = c.get("requestId");

    // Log error with context
    logger.error("Request failed", {
      module: "error-handler",
      requestId,
      path: c.req.path,
      error: error instanceof Error ? error.message : String(error),
    });

    // Handle known error types
    if (error instanceof ValidationError) {
      return c.json({
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
          requestId,
          details: error.details,
        }
      }, 400);
    }

    // Generic 500 response (safe message)
    return c.json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId,
      }
    }, 500);
  }
}
```

#### 5. `packages/server/src/routes/health.ts` (NEW)

**Purpose**: Health check endpoint

**Requirements**:
- No auth required
- Return uptime, timestamp, version
- Quick database connectivity check

**Pattern**:
```typescript
import { Hono } from "hono";

const app = new Hono();

app.get("/health", async c => {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();

  // Optional: DB check (keep it fast)
  // const dbHealthy = await checkDatabase();

  return c.json({
    status: "ok",
    uptime,
    timestamp,
    version: "0.0.1",
  });
});

export default app;
```

#### 6. `packages/server/src/routes/prompt.ts` (NEW)

**Purpose**: Alias for `/api/chat` endpoint

**Requirements**:
- Same logic as `/api/chat`
- Use sessionBridge middleware
- Support streaming and non-streaming

**Pattern**: Can either:
1. Re-export chat router: `export { default as promptRouter } from "./chat";`
2. Create new route that calls chat handler logic

#### 7. `packages/server/src/types.ts` (NEW)

**Purpose**: Shared type definitions

**Content**:
```typescript
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  uptime: number;
  timestamp: string;
  version: string;
}

// Custom error classes
export class ValidationError extends Error {
  code = "VALIDATION_ERROR" as const;
  status = 400;
  details: unknown;
  constructor(message: string, details: unknown) {
    super(message);
    this.details = details;
  }
}

export class AuthorizationError extends Error {
  code = "UNAUTHORIZED" as const;
  status = 401;
}

export class NotFoundError extends Error {
  code = "NOT_FOUND" as const;
  status = 404;
  constructor(resource: string) {
    super(`${resource} not found`);
  }
}
```

## Environment Configuration

### `.env.example` (Update)

Add new variables:
```bash
# Server Authentication
EKACODE_USERNAME=admin
EKACODE_PASSWORD=changeme
```

### Environment Loading in `index.ts`

Add validation:
```typescript
// Validate required env vars
const requiredEnvVars = ["EKACODE_USERNAME", "EKACODE_PASSWORD"];
const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}
```

## Test Patterns

### Existing Test Structure

Reference: `packages/server/tests/routes/permissions.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../index";

describe("Permissions API", () => {
  beforeEach(async () => {
    // Setup
  });

  it("should return pending permissions", async () => {
    const res = await app.request("/api/permissions/pending");
    expect(res.status).toBe(200);
    // ...
  });
});
```

### New Test Files to Create

1. `packages/server/tests/middleware/auth.test.ts`
   - Test Basic Auth success/failure
   - Test /health auth skip

2. `packages/server/tests/routes/health.test.ts`
   - Test health endpoint returns 200
   - Test no auth required

3. `packages/server/tests/middleware/error-handler.test.ts`
   - Test error responses have correct format
   - Test requestId is included

## Import Paths

All imports use workspace protocol:

```typescript
// From @ekacode/shared
import { createLogger } from "@ekacode/shared/logger";
import { resolveAppPaths } from "@ekacode/shared/paths";

// From @ekacode/core
import { Instance } from "@ekacode/core";

// Within @ekacode/server
import { sessionBridge } from "../middleware/session-bridge";
import type { Env } from "../index";
```

## Dependencies

### Existing (Already Installed)

- `hono` - Web framework
- `@hono/node-server` - Node adapter
- `@ekacode/shared/logger` - Pino logger
- `@ekacode/core` - Instance context
- `uuid` - UUID v7

### New Dependencies Required

None - all functionality can be built with existing dependencies.

Basic Auth parsing can use Node.js `Buffer`:
```typescript
const credentials = Buffer.from(b64Token, "base64").toString("utf-8");
const [username, password] = credentials.split(":");
```
