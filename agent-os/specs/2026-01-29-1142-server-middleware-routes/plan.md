# Plan: Server Middleware + Core Routes

**Spec ID**: `2026-01-29-1142-server-middleware-routes`
**Status**: Draft
**ROADMAP Task**: #4 - Add server middleware + core routes

## Overview

Migrate existing Hono server from Bearer token authentication to Basic Auth, add error handling middleware, and implement `/health` and `/prompt` endpoints. This spec covers mixed implementation (some components exist, some need creation).

## Current State Analysis

### Existing Components ✅

1. **Session Bridge Middleware** (`packages/server/src/middleware/session-bridge.ts`)
   - UUIDv7 session generation
   - Instance.provide() integration
   - Workspace detection from query/body/header
   - Database persistence

2. **Chat Endpoint** (`packages/server/src/routes/chat.ts`)
   - `/api/chat` with UIMessage streaming
   - Session info via `createSessionMessage()`
   - Integration with sessionBridge middleware

3. **Permission Routes** (`packages/server/src/routes/permissions.ts`)
   - Approval/clearing endpoints
   - PermissionManager integration

4. **Request Logging** (`packages/server/src/index.ts`)
   - Request ID generation (UUIDv7)
   - Duration tracking
   - Structured logging with Pino

5. **CORS Middleware** (`packages/server/src/index.ts`)
   - Allows localhost origins
   - Proper headers for X-Session-ID, X-Workspace

### Missing Components ❌

1. **Auth Migration**: Bearer token → Basic Auth
2. **Error Handling Middleware**: No centralized error handling
3. **/health Endpoint**: Exists as `/system/status`, needs rename
4. **/prompt Endpoint**: Does not exist
5. **Health Check Auth Skip**: Not implemented

## Implementation Tasks

### Task 1: Save Spec Documentation (MUST BE FIRST)

1. Create this spec folder structure
2. Write `plan.md` (this file)
3. Write `shape.md` (API contracts)
4. Write `standards.md` (code quality standards)
5. Write `references.md` (existing code references)

### Task 2: Add Error Handling Middleware

**File**: `packages/server/src/middleware/error-handler.ts`

```typescript
// Centralized error handling for:
// - ValidationError (Zod)
// - AuthorizationError
// - NotFoundError
// - Unknown errors (500 with safe message)
```

**Requirements**:
- Structured error responses with error codes
- Request ID in all error responses
- Log errors with context (module, requestId)
- Never leak sensitive data in 500 responses

### Task 3: Create Basic Auth Middleware

**File**: `packages/server/src/middleware/auth.ts`

```typescript
// Basic Auth (username:password) from config
// Skip /health endpoint
// Support configurable credentials
```

**Requirements**:
- Read credentials from environment (EKACODE_USERNAME, EKACODE_PASSWORD)
- Skip auth for `/health`
- Validate Basic header format
- Return 401 with WWW-Authenticate header on failure

### Task 4: Create /health Endpoint

**File**: `packages/server/src/routes/health.ts`

```typescript
GET /health
Response: { status: "ok", uptime: number, timestamp: string }
```

**Requirements**:
- No auth required (public endpoint)
- Return process uptime
- Return ISO timestamp
- Quick database connectivity check

### Task 5: Create /prompt Endpoint

**File**: `packages/server/src/routes/prompt.ts`

```typescript
POST /prompt
Body: { message: string, stream?: boolean }
Response: UIMessage stream
```

**Requirements**:
- Alias for /api/chat (same logic)
- Message streaming support
- Session integration
- Uses sessionBridge middleware

### Task 6: Update Main Server

**File**: `packages/server/src/index.ts`

Changes:
1. Remove Bearer token auth middleware
2. Add Basic Auth middleware (after CORS)
3. Add error handling middleware (last in chain)
4. Mount /health route (before auth)
5. Mount /prompt route
6. Update /api/config to return auth type

### Task 7: Update Environment Variables

**Files**:
- `.env.example`
- `packages/server/src/index.ts` (config loading)

Add:
```
EKACODE_USERNAME=admin
EKACODE_PASSWORD=changeme
```

### Task 8: Update Tests

**Files**: `packages/server/tests/**/*.test.ts`

Add tests for:
- Basic Auth success/failure
- /health endpoint (no auth)
- /prompt endpoint (with auth)
- Error handling middleware
- Auth skip for /health

## Migration Path

1. **Phase 1**: Add new middleware/routes alongside existing
2. **Phase 2**: Update main server to use new middleware
3. **Phase 3**: Remove old Bearer token auth
4. **Phase 4**: Update tests
5. **Phase 5**: Update documentation

## Acceptance Criteria

- [ ] All requests require Basic Auth (except /health)
- [ ] /health returns 200 with status/uptime/timestamp
- [ ] /prompt behaves like /api/chat
- [ ] Error responses include requestId and error codes
- [ ] No sensitive data in error responses
- [ ] All tests pass
- [ ] TypeScript/ESLint clean

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change for clients | High | Document migration path clearly |
| Basic Auth over HTTP | Medium | Server is loopback-only (127.0.0.1) |
| Missing error cases | Medium | Add comprehensive tests |
| Password in env var | Low | Recommend changing in production |

## Dependencies

- Requires: `packages/server` (existing)
- Requires: `@ekacode/shared/logger` (existing)
- Requires: `@ekacode/core` (Instance context, existing)

## Timeline Estimate

- Task 1: 30 min (save spec)
- Task 2: 1 hour (error middleware)
- Task 3: 1 hour (Basic Auth)
- Task 4: 30 min (/health)
- Task 5: 30 min (/prompt)
- Task 6: 30 min (main server)
- Task 7: 15 min (env vars)
- Task 8: 2 hours (tests)

**Total**: ~6 hours

## References

- Plans: `.claude/research/plans/new-architecture-plan.md:L730-L1203`
- ROADMAP: `.claude/research/plans/ROADMAP.md#task-4`
- Existing: `packages/server/src/`
- Standards: `agent-os/standards/`
