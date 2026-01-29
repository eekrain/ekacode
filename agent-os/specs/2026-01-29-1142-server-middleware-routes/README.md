# Spec: Server Middleware + Core Routes

**Spec ID**: `2026-01-29-1142-server-middleware-routes`
**Status**: Draft
**ROADMAP Task**: #4
**Created**: 2026-01-29

## Quick Summary

Migrate existing Hono server from Bearer token authentication to Basic Auth, add error handling middleware, and implement `/health` and `/prompt` endpoints.

**Estimate**: ~6 hours
**Risk Level**: Medium (breaking auth change)

## Documents

| Document | Description |
|----------|-------------|
| [plan.md](./plan.md) | Implementation plan with tasks and acceptance criteria |
| [shape.md](./shape.md) | API contracts and type definitions |
| [standards.md](./standards.md) | Code quality and security standards |
| [references.md](./references.md) | Existing code references and patterns |

## Overview

### Current State

- ✅ Session bridge middleware implemented with Instance.provide()
- ✅ Chat endpoint with UIMessage streaming
- ✅ Request logging and CORS middleware
- ❌ Bearer token auth (needs migration to Basic Auth)
- ❌ No error handling middleware
- ❌ `/health` exists as `/system/status` (needs rename)
- ❌ `/prompt` endpoint does not exist

### Changes

1. **Auth Migration**: Bearer token → Basic Auth (username:password)
2. **Error Handling**: Centralized error handler middleware
3. **Health Check**: `/health` endpoint (no auth required)
4. **Prompt Endpoint**: `/prompt` endpoint (alias for `/api/chat`)

### Files to Create

- `packages/server/src/middleware/auth.ts`
- `packages/server/src/middleware/error-handler.ts`
- `packages/server/src/routes/health.ts`
- `packages/server/src/routes/prompt.ts`
- `packages/server/src/types.ts`

### Files to Modify

- `packages/server/src/index.ts` - Update middleware chain
- `.env.example` - Add auth credentials

### Tests to Add

- `packages/server/tests/middleware/auth.test.ts`
- `packages/server/tests/middleware/error-handler.test.ts`
- `packages/server/tests/routes/health.test.ts`
- `packages/server/tests/routes/prompt.test.ts`

## Implementation Tasks

1. ✅ **Save Spec Documentation** (COMPLETE)
2. ⏳ **Add Error Handler Middleware** (~1 hour)
3. ⏳ **Create Basic Auth Middleware** (~1 hour)
4. ⏳ **Create /health Endpoint** (~30 min)
5. ⏳ **Create /prompt Endpoint** (~30 min)
6. ⏳ **Update Main Server** (~30 min)
7. ⏳ **Update Environment Variables** (~15 min)
8. ⏳ **Update Tests** (~2 hours)

## Acceptance Criteria

- [ ] All requests require Basic Auth (except /health)
- [ ] /health returns 200 with status/uptime/timestamp
- [ ] /prompt behaves like /api/chat
- [ ] Error responses include requestId and error codes
- [ ] No sensitive data in error responses
- [ ] All tests pass
- [ ] TypeScript/ESLint clean

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking auth change for clients | High | Document migration clearly |
| Missing error cases | Medium | Comprehensive tests |
| Password in env var | Low | Server is loopback-only |

## References

- **Plans**: `.claude/research/plans/new-architecture-plan.md:L730-L1203`
- **ROADMAP**: `.claude/research/plans/ROADMAP.md#task-4`
- **Standards**: `agent-os/standards/`
- **Existing**: `packages/server/src/`
