# Unified Event Schema for Chat Rendering

## Overview

This document defines the unified event schema for server-driven chat state management, aligned with OpenCode's architecture. All events use stable IDs and support part-by-part updates without duplication.

## Core Principles

1. **Server is source of truth** - All IDs generated server-side (UUIDv7)
2. **Normalized storage** - Messages and parts stored separately
3. **Part-level updates** - Updates target specific parts by ID
4. **Event coalescing** - Multiple deltas for same part batched per animation frame
5. **No client-side routing** - Rendering based purely on server parts

## Event Types

### Message Events

```typescript
// Server → Client: New message created
interface MessageCreatedEvent {
  type: "message.created";
  message: {
    id: string; // UUIDv7
    role: "user" | "assistant" | "system";
    sessionId: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
  };
}

// Server → Client: Message updated (metadata only)
interface MessageUpdatedEvent {
  type: "message.updated";
  message: {
    id: string;
    metadata?: Record<string, unknown>;
  };
}

// Server → Client: Message removed
interface MessageRemovedEvent {
  type: "message.removed";
  messageId: string;
}
```

### Part Events

```typescript
// Server → Client: New part created
interface PartCreatedEvent {
  type: "part.created";
  part: {
    id: string; // UUIDv7
    messageId: string; // Parent message ID
    sessionId: string;
    type: PartType;
    content: unknown;
    createdAt: number;
    order: number; // Sort order within message
  };
}

// Server → Client: Part updated (full replacement)
interface PartUpdatedEvent {
  type: "part.updated";
  part: {
    id: string;
    messageId: string;
    content: unknown;
    updatedAt: number;
  };
  delta?: string; // Optional delta for streaming UI updates
}

// Server → Client: Part removed
interface PartRemovedEvent {
  type: "part.removed";
  partId: string;
  messageId: string;
}
```

### Part Types

```typescript
type PartType =
  | "text" // Text content (streaming)
  | "tool-call" // Tool invocation
  | "tool-result" // Tool execution result
  | "reasoning" // Reasoning/thinking content
  | "run" // Run card (planning mode)
  | "run-group" // Run group (planning mode)
  | "run-item" // Run item (planning mode)
  | "action" // Build mode action
  | "state" // Execution state
  | "error"; // Error message

// Text Part
interface TextPart {
  type: "text";
  text: string;
  status: "streaming" | "complete";
}

// Tool Call Part
interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "error";
}

// Tool Result Part
interface ToolResultPart {
  type: "tool-result";
  toolCallId: string; // Links to tool-call part
  result: unknown;
  error?: string;
}

// Reasoning Part
interface ReasoningPart {
  type: "reasoning";
  reasoningId: string;
  text: string;
  status: "thinking" | "complete";
  durationMs?: number;
  agentId?: string;
}

// Run Card Part (Planning Mode)
interface RunCardPart {
  type: "run";
  runId: string;
  title: string;
  subtitle?: string;
  status: "planning" | "executing" | "done" | "error";
  filesEditedOrder: string[];
  groupsOrder: string[];
  startedAt?: number;
  finishedAt?: number;
  elapsedMs?: number;
}

// Run Group Part
interface RunGroupPart {
  type: "run-group";
  groupId: string;
  runId: string;
  index: number;
  title: string;
  collapsed: boolean;
  itemsOrder: string[];
}

// Run Item Part
interface RunItemPart {
  type: "run-item";
  itemId: string;
  groupId: string;
  kind: AgentEventKind;
  title: string;
  subtitle?: string;
  timestamp: number;
  file?: { path: string; range?: string };
  diff?: { plus: number; minus: number };
  terminal?: {
    command: string;
    cwd?: string;
    outputPreview: string;
    exitCode?: number;
  };
  error?: { message: string; details?: string };
  actions?: AgentEventAction[];
}

// Action Part (Build Mode)
interface ActionPart {
  type: "action";
  actionId: string;
  kind: AgentEventKind;
  title: string;
  subtitle?: string;
  timestamp: number;
  toolCallId?: string;
  agentId?: string;
  file?: { path: string; range?: string };
  diff?: { plus: number; minus: number };
  terminal?: {
    command: string;
    cwd?: string;
    outputPreview: string;
    exitCode?: number;
  };
  error?: { message: string; details?: string };
  actions?: AgentEventAction[];
}

// State Part
interface StatePart {
  type: "state";
  state: "idle" | "running" | "completed" | "failed";
  iteration?: number;
  toolExecutionCount?: number;
}

// Error Part
interface ErrorPart {
  type: "error";
  message: string;
  details?: string;
}
```

### Stream Control Events

```typescript
// Server → Client: Stream started
interface StreamStartedEvent {
  type: "stream.started";
  sessionId: string;
  messageId: string;
  timestamp: number;
}

// Server → Client: Stream finished
interface StreamFinishedEvent {
  type: "stream.finished";
  sessionId: string;
  messageId: string;
  finishReason: "stop" | "error" | "cancelled";
  timestamp: number;
}

// Server → Client: Error occurred
interface StreamErrorEvent {
  type: "stream.error";
  sessionId: string;
  messageId?: string;
  error: string;
  timestamp: number;
}
```

## Client Store Structure

```typescript
interface ChatStore {
  // Normalized message storage
  messages: {
    byId: Record<string, Message>;
    order: string[]; // Ordered message IDs
  };

  // Normalized part storage
  parts: {
    byId: Record<string, Part>;
    byMessageId: Record<string, string[]>; // messageId -> partId[]
  };

  // Session state
  session: {
    id: string | null;
    status: "idle" | "connecting" | "streaming" | "error";
    error: Error | null;
  };

  // UI state
  ui: {
    showReasoning: boolean;
    compactMode: boolean;
    // ... other UI preferences
  };
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  sessionId: string;
  createdAt: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

interface Part {
  id: string;
  messageId: string;
  sessionId: string;
  type: PartType;
  content: unknown;
  createdAt: number;
  updatedAt?: number;
  order: number;
}
```

## Update Rules

### Part Updates (Share-Style)

1. **If part exists** → Replace in place (update `content` and `updatedAt`)
2. **If part missing** → Insert by ID (respecting `order`)
3. **Delta updates** → Append delta to text content for streaming

### Event Coalescing

```typescript
// Batch updates per animation frame (16ms)
interface CoalescedUpdate {
  messages: Map<string, Message>; // messageId -> Message
  parts: Map<string, Part>; // partId -> Part
  deltas: Map<string, string>; // partId -> accumulated delta
}

// Process coalesced batch
function processBatch(batch: CoalescedUpdate) {
  // Apply all message updates
  for (const [id, message] of batch.messages) {
    upsertMessage(message);
  }

  // Apply all part updates (full replacement)
  for (const [id, part] of batch.parts) {
    upsertPart(part);
  }

  // Apply accumulated deltas
  for (const [partId, delta] of batch.deltas) {
    appendDeltaToPart(partId, delta);
  }
}
```

## Migration from Current System

### Current Issues

1. **Client generates message IDs** - Should use server-provided IDs
2. **Parts stored inline** - Should be normalized
3. **Three-message split** - Should be single message with multiple parts
4. **No event coalescing** - Should batch per animation frame
5. **Complex routing logic** - Should render based on parts

### Migration Path

1. Server assigns UUIDv7 to all parts
2. Client stores parts separately from messages
3. Remove preamble/activity/final split
4. Add event coalescing layer
5. Update rendering to use parts array

## Backward Compatibility

During migration, support both old and new event formats:

```typescript
function normalizeEvent(event: unknown): UnifiedEvent | null {
  // Handle legacy format
  if (isLegacyEvent(event)) {
    return convertLegacyEvent(event);
  }

  // Handle new format
  if (isUnifiedEvent(event)) {
    return event;
  }

  return null;
}
```

## Implementation Checklist

- [ ] Server emits `part.created` with UUIDv7 IDs
- [ ] Server emits `part.updated` for streaming content
- [ ] Client stores parts normalized (byId + byMessageId)
- [ ] Client coalesces events per animation frame
- [ ] Client renders based on parts, not message routing
- [ ] Session sync fetches messages + parts together
- [ ] Tool call/result update same part ID
- [ ] Remove legacy preamble/activity/final logic
