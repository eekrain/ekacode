# Phase 1: Server & Agent Core — Applicable Standards

**Created**: 2025-01-25
**Source**: `agent-os/standards/global/tech-stack.md`

---

## Technology Stack Standards

### Backend Frameworks

#### Hono (HTTP API Gateway)

- **Version**: Latest (Node adapter)
- **Usage**: Internal loopback server for agent API
- **Key Features**:
  - Native SSE support via `streamSSE` helper
  - Fetch/Request/Response-native types
  - Minimal overhead for localhost communication

#### Electron IPC (Main-Renderer Communication)

- **Pattern**: `invoke/handle` for request/response
- **Exposure**: `contextBridge` to expose minimal, typed API
- **Security**: No raw `ipcRenderer` in renderer process
- **Best Practices**:
  - Centralize channel constants in `shared/ipc.ts`
  - Validate all payloads with Zod
  - Avoid synchronous IPC

#### Mastra (Agent Orchestration)

- **Version**: Latest (vNext workflow engine)
- **Features**:
  - TypeScript-first with full type safety
  - Structured tools with Zod validation
  - Streaming via `.stream()` method
  - Tool approval workflows
  - Processors for context management

#### TanStack AI (Streaming Consumer)

- **Version**: Latest
- **Integration**: `useChat` hook with `fetchServerSentEvents`
- **Protocol**: SSE for streaming responses
- **Features**: Streaming message rendering, stop/cancel support

### Validation & Schema

#### Zod

- **Version**: ^3.x
- **Usage**: Runtime schema validation for
  - Tool inputs and outputs
  - IPC payloads
  - API contracts
  - Permission rules
- **Benefits**: TypeScript type inference from schemas

---

## Security Patterns

### Localhost Security

#### Server Binding

- **Address**: 127.0.0.1 only (loopback interface)
- **Port**: OS-assigned (pass 0 to server.listen)
- **Purpose**: Prevent external network access

#### Authentication

- **Method**: Bearer token in Authorization header
- **Token Generation**: `crypto.randomBytes(32)` → hex string
- **Storage**: In-memory only (ephemeral per session)
- **Transmission**: Via secure IPC channel only

#### DNS Rebinding Protection

- **Implementation**: Strict Host header validation
- **Required**: Host header must match `localhost` or `127.0.0.1`
- **Purpose**: Prevent DNS rebinding attacks

### Electron Security

#### Renderer Sandboxing

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: false` (for preload, but sandboxed renderer)

#### IPC Security

- No raw `ipcRenderer` access
- All APIs exposed via `contextBridge`
- Structured clone-safe payloads only
- No sensitive data in renderer globals

---

## API Standards

### REST Endpoints

#### System Endpoints

```
GET /system/status
  - Auth: Bearer token required
  - Response: { status: 'ok', version: string }

GET /system/config
  - Auth: Bearer token required
  - Response: { version, capabilities } (no secrets)

GET /system/paths
  - Auth: Bearer token required
  - Response: { workspace: string, home: string }
```

#### Chat Endpoint

```
POST /api/chat
  - Auth: Bearer token required
  - Body: { messages: Message[], threadId?, resourceId? }
  - Response: SSE stream of StreamChunk objects
```

#### Approval Endpoints

```
POST /api/approvals/:id
  - Auth: Bearer token required
  - Body: { approved: boolean, reason?: string }
  - Response: { success: boolean }
```

### SSE Protocol

#### StreamChunk Format (TanStack AI)

```typescript
type StreamChunk =
  | { type: "content"; content: string }
  | { type: "tool_call"; toolCall: ToolCall }
  | { type: "tool_result"; toolResult: ToolResult }
  | { type: "approval-requested"; approval: ApprovalRequest }
  | { type: "done" }
  | { type: "error"; error: string };
```

#### Event Mapping (Mastra → TanStack)

| Mastra Event       | TanStack Type      |
| ------------------ | ------------------ |
| text-delta         | content            |
| tool-call          | tool_call          |
| tool-result        | tool_result        |
| approval-requested | approval-requested |
| finish             | done               |
| error              | error              |

---

## Code Organization Standards

### Package Structure

```
packages/
├── shared/         # Types, IPC constants, shared schemas
├── server/         # Hono server, routes, middleware
├── ekacode/        # Mastra agents, tools, workflows
└── desktop/        # Electron main, preload, renderer
```

### Import Patterns

- Internal packages: `@ekacode/*` via `workspace:*`
- External packages: Import from package root, not deep paths
- Type exports: Explicit `export type` for type-only exports

---

## Error Handling Standards

### Server Errors

- **400**: Bad Request (invalid JSON, schema validation failed)
- **401**: Unauthorized (missing/invalid bearer token)
- **403**: Forbidden (permission denied)
- **404**: Not Found (unknown endpoint)
- **500**: Internal Server Error (unexpected errors)

### SSE Error Handling

- Send `error` chunk on stream errors
- Close connection gracefully
- Log errors with context

---

## Testing Standards

### Unit Tests

- Test individual functions and classes
- Mock external dependencies
- Fast execution (< 1s per test)

### Integration Tests

- Test full request/response cycles
- Test SSE streaming with actual client
- Test authentication flows
- Test permission evaluation

### Test Organization

```
packages/server/src/__tests__/
├── unit/
│   ├── auth.test.ts
│   └── engine.test.ts
└── integration/
    └── api.test.ts
```

---

## Performance Guidelines

### Startup Time

- Server startup: < 500ms
- Token generation: < 10ms
- Agent initialization: < 200ms

### Streaming Latency

- SSE chunk emission: < 50ms from event
- First token: < 200ms from request

### Memory

- Server base memory: < 50MB
- Per-connection overhead: < 1MB
- Agent context: Variable, monitored

---

## Future Considerations

### Phase 2 Preparation

- Tool registry patterns for filesystem/shell/search
- Permission rule expansion for tool-specific policies
- Server infrastructure for external tool integration

### Phase 3 Preparation

- IPC patterns for memory layer queries
- Streaming patterns for database results
- Server architecture for libSQL integration

### Phase 4 Preparation

- Renderer-ready SSE protocols
- UI component data structures
- Permission UI flow endpoints
