# Shape: Server Middleware + Core Routes API

**Spec ID**: `2026-01-29-1142-server-middleware-routes`

## API Contracts

### Error Response Schema

All error responses follow this structure:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    requestId: string;      // Request UUID for tracing
    details?: unknown;      // Additional context (safe for client)
  };
}
```

**Error Codes**:
- `UNAUTHORIZED` (401): Missing or invalid credentials
- `FORBIDDEN` (403): Valid credentials but insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request body/params
- `INTERNAL_ERROR` (500): Unexpected server error

### 1. Basic Auth Middleware

**Middleware**: `packages/server/src/middleware/auth.ts`

```typescript
interface AuthConfig {
  username: string;
  password: string;
}

// Environment variables
EKACODE_USERNAME: string;  // Default: "admin"
EKACODE_PASSWORD: string;  // Default: "changeme"

// Request header
Authorization: "Basic <base64(username:password)>"

// Success: Continue to next middleware
// Failure: 401 with WWW-Authenticate header
```

**Error Response (401)**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials",
    "requestId": "01234567-89ab-cdef-0123-456789abcdef"
  }
}
```

### 2. Error Handler Middleware

**Middleware**: `packages/server/src/middleware/error-handler.ts`

```typescript
interface ErrorContext {
  module: string;
  requestId: string;
  path: string;
  method: string;
}

// Caught errors are logged with context
// Client receives safe error response
```

**Custom Error Classes**:
```typescript
class ValidationError extends Error {
  code = "VALIDATION_ERROR";
  status = 400;
  details: z.ZodError | unknown;
}

class AuthorizationError extends Error {
  code = "UNAUTHORIZED";
  status = 401;
}

class NotFoundError extends Error {
  code = "NOT_FOUND";
  status = 404;
  resource: string;
}
```

### 3. Health Check Endpoint

**Route**: `GET /health`

**Auth**: Not required (public endpoint)

**Request**: No body or parameters

**Response (200)**:
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-01-29T11:42:00.000Z",
  "version": "0.0.1"
}
```

**Error Response (503)**:
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Database connection failed",
    "requestId": "01234567-89ab-cdef-0123-456789abcdef"
  }
}
```

### 4. Prompt Endpoint

**Route**: `POST /prompt`

**Auth**: Required (Basic Auth)

**Request Headers**:
```
Authorization: Basic <credentials>
Content-Type: application/json
X-Session-ID: <session-id> (optional)
```

**Request Body**:
```json
{
  "message": "Hello, AI!",
  "stream": true,
  "directory": "/absolute/path/to/workspace" (optional)
}
```

**Response (streaming, UIMessage format)**:
```
data: {"type":"data-session","id":"session","data":{...}}
data: {"type":"text-delta","id":"msg-1","delta":"Echo: ..."}
data: {"type":"finish","finishReason":"stop","id":"msg-1"}
```

**Response (non-streaming)**:
```json
{
  "sessionId": "01234567-89ab-cdef-0123-456789abcdef",
  "response": "Echo: You said \"Hello, AI!\""
}
```

**Error Response (400)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "requestId": "01234567-89ab-cdef-0123-456789abcdef",
    "details": {
      "issues": [...]
    }
  }
}
```

### 5. Config Endpoint (Updated)

**Route**: `GET /api/config`

**Auth**: Required (Basic Auth)

**Response**:
```json
{
  "authType": "basic",
  "baseUrl": "http://127.0.0.1:12345",
  "version": "0.0.1"
}
```

## Middleware Order

```
1. CORS middleware (always first)
2. Request logging (requestId, timing)
3. Basic Auth middleware (skip /health)
4. Session bridge (X-Session-ID handling)
5. Route handlers
6. Error handler (always last)
```

## Type Definitions

```typescript
// packages/server/src/types.ts

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

export interface PromptRequest {
  message: string;
  stream?: boolean;
  directory?: string;
}

export interface ConfigResponse {
  authType: "basic";
  baseUrl: string;
  version: string;
}
```

## UIMessage Stream Parts

Refer to Vercel AI SDK v6 UIMessage format:

```typescript
// Session info (first message if new session)
type DataSessionPart = {
  type: "data-session";
  id: "session";
  data: {
    sessionId: string;
    resourceId: string;
    threadId: string;
    createdAt: string;
    lastAccessed: string;
  };
};

// Text delta
type TextDeltaPart = {
  type: "text-delta";
  id: string;
  delta: string;
};

// Finish
type FinishPart = {
  type: "finish";
  finishReason: "stop" | "length" | "error";
  id: string;
};
```
