# Opencode Stream Architecture Deep Dive

## Table of Contents

1. [Overview](#overview)
2. [Stream Protocol](#stream-protocol)
3. [Message/Part Architecture](#messagepart-architecture)
4. [State Management](#state-management)
5. [UI Rendering](#ui-rendering)
6. [Event System](#event-system)
7. [Storage Layer](#storage-layer)
8. [Tool System](#tool-system)
9. [Session Management](#session-management)
10. [Key Insights for ekacode](#key-insights-for-ekacode)

---

## Overview

Opencode uses a sophisticated streaming architecture built on:

- **Server-Sent Events (SSE)** for real-time communication
- **Part-based message model** where all content types are unified
- **Event-driven state management** via a Bus system
- **Normalized storage** separating messages from parts
- **Throttled UI rendering** for performance

---

## Stream Protocol

### Protocol: Server-Sent Events (SSE)

Opencode uses SSE via the `/event` endpoint for all real-time communication between server and client.

**Server Implementation** (`packages/opencode/src/server/server.ts:477-531`):

```typescript
.get(
  "/event",
  describeRoute({
    summary: "Subscribe to events",
    description: "Get events",
    operationId: "event.subscribe",
    responses: {
      200: {
        description: "Event stream",
        content: {
          "text/event-stream": {
            schema: resolver(BusEvent.payloads()),
          },
        },
      },
    },
  }),
  async (c) => {
    log.info("event connected")
    return streamSSE(c, async (stream) => {
      // Send initial connection event
      stream.writeSSE({
        data: JSON.stringify({
          type: "server.connected",
          properties: {},
        }),
      })

      // Subscribe to all bus events
      const unsub = Bus.subscribeAll(async (event) => {
        await stream.writeSSE({
          data: JSON.stringify(event),
        })
        if (event.type === Bus.InstanceDisposed.type) {
          stream.close()
        }
      })

      // Heartbeat every 30s to prevent WKWebView timeout (60s default)
      const heartbeat = setInterval(() => {
        stream.writeSSE({
          data: JSON.stringify({
            type: "server.heartbeat",
            properties: {},
          }),
        })
      }, 30000)

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat)
          unsub()
          resolve()
          log.info("event disconnected")
        })
      })
    })
  },
)
```

### Event Structure

All events follow a consistent structure:

```typescript
{
  type: string,        // Event type identifier
  properties: object   // Event-specific data
}
```

**Core Event Types:**

| Event                  | Description              | Properties                          |
| ---------------------- | ------------------------ | ----------------------------------- |
| `server.connected`     | Initial connection       | `{}`                                |
| `server.heartbeat`     | Keep-alive ping          | `{}`                                |
| `message.updated`      | Message metadata changed | `{ info: MessageInfo }`             |
| `message.part.updated` | Part content changed     | `{ part: Part, delta?: string }`    |
| `message.removed`      | Message deleted          | `{ sessionID, messageID }`          |
| `message.part.removed` | Part deleted             | `{ sessionID, messageID, partID }`  |
| `session.created`      | New session              | `{ info: SessionInfo }`             |
| `session.updated`      | Session changed          | `{ info: SessionInfo }`             |
| `session.deleted`      | Session removed          | `{ info: SessionInfo }`             |
| `session.status`       | Session state            | `{ sessionID, status: StatusInfo }` |
| `session.error`        | Error occurred           | `{ sessionID?, error: ErrorInfo }`  |
| `permission.asked`     | Permission request       | `PermissionRequest`                 |
| `question.asked`       | Question asked           | `QuestionRequest`                   |

### Event Bus System

**Bus Implementation** (`packages/opencode/src/bus/index.ts`):

```typescript
export namespace Bus {
  const state = Instance.state(
    () => {
      const subscriptions = new Map<any, Subscription[]>()
      return { subscriptions }
    },
    async (entry) => {
      // Cleanup on dispose
      const wildcard = entry.subscriptions.get("*")
      if (!wildcard) return
      const event = {
        type: InstanceDisposed.type,
        properties: { directory: Instance.directory },
      }
      for (const sub of [...wildcard]) {
        sub(event)
      }
    },
  )

  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    const payload = { type: def.type, properties }
    log.info("publishing", { type: def.type })

    const pending = []
    // Publish to specific type subscribers
    for (const key of [def.type, "*"]) {
      const match = state().subscriptions.get(key)
      for (const sub of match ?? []) {
        pending.push(sub(payload))
      }
    }

    // Also emit to global bus for cross-instance communication
    GlobalBus.emit("event", { directory: Instance.directory, payload })
    return Promise.all(pending)
  }

  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: ... }) => void,
  ) {
    return raw(def.type, callback)
  }

  export function subscribeAll(callback: (event: any) => void) {
    return raw("*", callback)
  }
}
```

**BusEvent Definition** (`packages/opencode/src/bus/bus-event.ts`):

```typescript
export namespace BusEvent {
  export type Definition = ReturnType<typeof define>;
  const registry = new Map<string, Definition>();

  export function define<Type extends string, Properties extends ZodType>(
    type: Type,
    properties: Properties
  ) {
    const result = { type, properties };
    registry.set(type, result);
    return result;
  }

  export function payloads() {
    return z
      .discriminatedUnion(
        "type",
        registry
          .entries()
          .map(([type, def]) => {
            return z
              .object({
                type: z.literal(type),
                properties: def.properties,
              })
              .meta({ ref: "Event." + def.type });
          })
          .toArray() as any
      )
      .meta({ ref: "Event" });
  }
}
```

---

## Message/Part Architecture

### Core Philosophy

Opencode uses a **part-based architecture** where:

- A single assistant message contains ALL content types
- Content is split into typed "parts" in an array
- Each part has its own lifecycle, timestamps, and metadata
- No artificial splitting of text around tool calls

### Part Type Definitions

**Base Part** (`packages/opencode/src/session/message-v2.ts:39-43`):

```typescript
const PartBase = z.object({
  id: z.string(), // Unique part ID
  sessionID: z.string(), // Parent session
  messageID: z.string(), // Parent message
});
```

**Text Part** (`packages/opencode/src/session/message-v2.ts:62-77`):

```typescript
export const TextPart = PartBase.extend({
  type: z.literal("text"),
  text: z.string(),
  synthetic: z.boolean().optional(), // Auto-generated (not from AI)
  ignored: z.boolean().optional(), // Don't send to AI
  time: z
    .object({
      start: z.number(), // When streaming started
      end: z.number().optional(), // When streaming ended
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(), // Provider metadata
}).meta({ ref: "TextPart" });
```

**Tool Part** (`packages/opencode/src/session/message-v2.ts:291-300`):

```typescript
export const ToolPart = PartBase.extend({
  type: z.literal("tool"),
  callID: z.string(), // Tool call ID from AI
  tool: z.string(), // Tool name
  state: ToolState, // pending | running | completed | error
  metadata: z.record(z.string(), z.any()).optional(),
}).meta({ ref: "ToolPart" });

// Tool states:
export const ToolStatePending = z
  .object({
    status: z.literal("pending"),
    input: z.record(z.string(), z.any()),
    raw: z.string(), // Raw JSON input being streamed
  })
  .meta({ ref: "ToolStatePending" });

export const ToolStateRunning = z
  .object({
    status: z.literal("running"),
    input: z.record(z.string(), z.any()),
    title: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    time: z.object({ start: z.number() }),
  })
  .meta({ ref: "ToolStateRunning" });

export const ToolStateCompleted = z
  .object({
    status: z.literal("completed"),
    input: z.record(z.string(), z.any()),
    output: z.string(),
    title: z.string(),
    metadata: z.record(z.string(), z.any()),
    time: z.object({
      start: z.number(),
      end: z.number(),
      compacted: z.number().optional(), // When content was compacted
    }),
    attachments: FilePart.array().optional(),
  })
  .meta({ ref: "ToolStateCompleted" });

export const ToolStateError = z
  .object({
    status: z.literal("error"),
    input: z.record(z.string(), z.any()),
    error: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
    time: z.object({ start: z.number(), end: z.number() }),
  })
  .meta({ ref: "ToolStateError" });
```

**Reasoning Part** (`packages/opencode/src/session/message-v2.ts:79-90`):

```typescript
export const ReasoningPart = PartBase.extend({
  type: z.literal("reasoning"),
  text: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  time: z.object({
    start: z.number(),
    end: z.number().optional(),
  }),
}).meta({ ref: "ReasoningPart" });
```

**Step Parts** (`packages/opencode/src/session/message-v2.ts:196-221`):

```typescript
export const StepStartPart = PartBase.extend({
  type: z.literal("step-start"),
  snapshot: z.string().optional(), // Git snapshot ID
}).meta({ ref: "StepStartPart" });

export const StepFinishPart = PartBase.extend({
  type: z.literal("step-finish"),
  reason: z.string(), // finish reason
  snapshot: z.string().optional(),
  cost: z.number(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    reasoning: z.number(),
    cache: z.object({ read: z.number(), write: z.number() }),
  }),
}).meta({ ref: "StepFinishPart" });
```

**File Part** (`packages/opencode/src/session/message-v2.ts:133-142`):

```typescript
export const FilePart = PartBase.extend({
  type: z.literal("file"),
  mime: z.string(),
  filename: z.string().optional(),
  url: z.string(), // data: URL or file:// URL
  source: FilePartSource.optional(), // Symbol/file reference info
}).meta({ ref: "FilePart" });
```

**Other Part Types:**

```typescript
// Agent invocation (@agent mention)
export const AgentPart = PartBase.extend({
  type: z.literal("agent"),
  name: z.string(),
  source: z
    .object({
      value: z.string(),
      start: z.number().int(),
      end: z.number().int(),
    })
    .optional(),
}).meta({ ref: "AgentPart" });

// Subtask delegation
export const SubtaskPart = PartBase.extend({
  type: z.literal("subtask"),
  prompt: z.string(),
  description: z.string(),
  agent: z.string(),
  model: z
    .object({
      providerID: z.string(),
      modelID: z.string(),
    })
    .optional(),
  command: z.string().optional(),
}).meta({ ref: "SubtaskPart" });

// Conversation compaction marker
export const CompactionPart = PartBase.extend({
  type: z.literal("compaction"),
  auto: z.boolean(),
}).meta({ ref: "CompactionPart" });

// Retry attempt tracking
export const RetryPart = PartBase.extend({
  type: z.literal("retry"),
  attempt: z.number(),
  error: APIError.Schema,
  time: z.object({ created: z.number() }),
}).meta({ ref: "RetryPart" });

// Snapshot reference
export const SnapshotPart = PartBase.extend({
  type: z.literal("snapshot"),
  snapshot: z.string(),
}).meta({ ref: "SnapshotPart" });

// Patch/diff reference
export const PatchPart = PartBase.extend({
  type: z.literal("patch"),
  hash: z.string(),
  files: z.string().array(),
}).meta({ ref: "PatchPart" });
```

**Part Union** (`packages/opencode/src/session/message-v2.ts:332-350`):

```typescript
export const Part = z
  .discriminatedUnion("type", [
    TextPart,
    SubtaskPart,
    ReasoningPart,
    FilePart,
    ToolPart,
    StepStartPart,
    StepFinishPart,
    SnapshotPart,
    PatchPart,
    AgentPart,
    RetryPart,
    CompactionPart,
  ])
  .meta({ ref: "Part" });
```

### Message Types

**User Message** (`packages/opencode/src/session/message-v2.ts:307-330`):

```typescript
export const User = Base.extend({
  role: z.literal("user"),
  time: z.object({ created: z.number() }),
  summary: z
    .object({
      title: z.string().optional(),
      body: z.string().optional(),
      diffs: Snapshot.FileDiff.array(),
    })
    .optional(),
  agent: z.string(), // Which agent to use
  model: z.object({
    providerID: z.string(),
    modelID: z.string(),
  }),
  system: z.string().optional(), // Custom system prompt
  tools: z.record(z.string(), z.boolean()).optional(),
  variant: z.string().optional(), // Model variant (e.g., "thinking")
}).meta({ ref: "UserMessage" });
```

**Assistant Message** (`packages/opencode/src/session/message-v2.ts:352-394`):

```typescript
export const Assistant = Base.extend({
  role: z.literal("assistant"),
  time: z.object({
    created: z.number(),
    completed: z.number().optional(), // When response finished
  }),
  error: z
    .discriminatedUnion("name", [
      AuthError.Schema,
      NamedError.Unknown.Schema,
      OutputLengthError.Schema,
      AbortedError.Schema,
      APIError.Schema,
    ])
    .optional(),
  parentID: z.string(), // ID of user message this responds to
  modelID: z.string(),
  providerID: z.string(),
  mode: z.string(), // Agent mode (deprecated)
  agent: z.string(), // Agent name
  path: z.object({
    cwd: z.string(), // Working directory
    root: z.string(), // Git root
  }),
  summary: z.boolean().optional(), // Whether message was summarized
  cost: z.number(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    reasoning: z.number(),
    cache: z.object({ read: z.number(), write: z.number() }),
  }),
  finish: z.string().optional(), // Finish reason
}).meta({ ref: "AssistantMessage" });
```

**Message with Parts** (`packages/opencode/src/session/message-v2.ts:432-436`):

```typescript
export const WithParts = z.object({
  info: Info, // User | Assistant
  parts: z.array(Part),
});
```

### Message Events

```typescript
export const Event = {
  Updated: BusEvent.define("message.updated", z.object({ info: Info })),
  Removed: BusEvent.define(
    "message.removed",
    z.object({ sessionID: z.string(), messageID: z.string() })
  ),
  PartUpdated: BusEvent.define(
    "message.part.updated",
    z.object({
      part: Part,
      delta: z.string().optional(), // For text streaming
    })
  ),
  PartRemoved: BusEvent.define(
    "message.part.removed",
    z.object({
      sessionID: z.string(),
      messageID: z.string(),
      partID: z.string(),
    })
  ),
};
```

---

## State Management

### No Global Store Library

Opencode does NOT use Redux, Zustand, or similar. Instead:

- Simple object structures passed to UI
- SolidJS `createStore` for local component state
- Event-driven updates via SSE

### Data Context Structure

**UI Data Context** (`packages/ui/src/context/data.tsx`):

```typescript
type Data = {
  // Sessions
  session: Session[];
  session_status: {
    [sessionID: string]: SessionStatus;
  };
  session_diff: {
    [sessionID: string]: FileDiff[];
  };
  session_diff_preload?: {
    [sessionID: string]: PreloadMultiFileDiffResult<any>[];
  };

  // Permissions and questions
  permission?: {
    [sessionID: string]: PermissionRequest[];
  };
  question?: {
    [sessionID: string]: QuestionRequest[];
  };

  // Messages - keyed by session ID
  message: {
    [sessionID: string]: Message[];
  };

  // Parts - keyed by message ID (normalized)
  part: {
    [messageID: string]: Part[];
  };
};

export const { use: useData, provider: DataProvider } = createSimpleContext({
  name: "Data",
  init: (props: {
    data: Data;
    directory: string;
    onPermissionRespond?: PermissionRespondFn;
    onQuestionReply?: QuestionReplyFn;
    onQuestionReject?: QuestionRejectFn;
    onNavigateToSession?: NavigateToSessionFn;
  }) => {
    return {
      get store() {
        return props.data;
      },
      get directory() {
        return props.directory;
      },
      respondToPermission: props.onPermissionRespond,
      replyToQuestion: props.onQuestionReply,
      rejectQuestion: props.onQuestionReject,
      navigateToSession: props.onNavigateToSession,
    };
  },
});
```

### State Update Flow

1. **Server processes AI stream** → Creates/updates parts
2. **Server publishes events** via `Bus.publish()`
3. **SSE endpoint** receives events and forwards to client
4. **Client updates local data structure**
5. **SolidJS reactivity** triggers UI re-renders

**Example from CLI** (`packages/opencode/src/cli/cmd/run.ts:403-511`):

```typescript
const events = await sdk.event.subscribe();

for await (const event of events.stream) {
  if (event.type === "message.updated" && event.properties.info.role === "assistant") {
    // Show agent info
    UI.println(`> ${event.properties.info.agent} · ${event.properties.info.modelID}`);
  }

  if (event.type === "message.part.updated") {
    const part = event.properties.part;
    if (part.sessionID !== sessionID) continue;

    if (part.type === "tool" && part.state.status === "completed") {
      // Render tool result
      tool(part);
    }

    if (part.type === "text" && part.time?.end) {
      // Render completed text
      const text = part.text.trim();
      UI.println(text);
    }

    if (part.type === "reasoning" && part.time?.end) {
      // Render reasoning
      UI.println(`Thinking: ${part.text.trim()}`);
    }
  }

  if (event.type === "session.error") {
    // Handle error
    UI.error(event.properties.error);
  }

  if (event.type === "session.status" && event.properties.status.type === "idle") {
    // Stream complete
    break;
  }
}
```

---

## UI Rendering

### Part Component Registry

**Dynamic Part Rendering** (`packages/ui/src/components/message-part.tsx:106-496`):

```typescript
export type PartComponent = Component<MessagePartProps>

export const PART_MAPPING: Record<string, PartComponent | undefined> = {}

export function registerPartComponent(type: string, component: PartComponent) {
  PART_MAPPING[type] = component
}

export function Part(props: MessagePartProps) {
  const component = createMemo(() => PART_MAPPING[props.part.type])
  return (
    <Show when={component()}>
      <Dynamic
        component={component()}
        part={props.part}
        message={props.message}
        hideDetails={props.hideDetails}
        defaultOpen={props.defaultOpen}
      />
    </Show>
  )
}
```

### Text Part Rendering with Throttling

**Throttled Value Hook** (`packages/ui/src/components/message-part.tsx:108-147`):

```typescript
const TEXT_RENDER_THROTTLE_MS = 100;

function createThrottledValue(getValue: () => string) {
  const [value, setValue] = createSignal(getValue());
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let last = 0;

  createEffect(() => {
    const next = getValue();
    const now = Date.now();
    const remaining = TEXT_RENDER_THROTTLE_MS - (now - last);

    if (remaining <= 0) {
      // Enough time passed, update immediately
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      last = now;
      setValue(next);
      return;
    }

    // Schedule update
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      last = Date.now();
      setValue(next);
      timeout = undefined;
    }, remaining);
  });

  onCleanup(() => {
    if (timeout) clearTimeout(timeout);
  });

  return value;
}
```

**Text Part Component** (`packages/ui/src/components/message-part.tsx:668-708`):

```typescript
PART_MAPPING["text"] = function TextPartDisplay(props) {
  const data = useData()
  const i18n = useI18n()
  const part = props.part as TextPart

  // Get display text with path relativization
  const displayText = () => relativizeProjectPaths(
    (part.text ?? "").trim(),
    data.directory
  )

  // Throttle updates to prevent UI jank
  const throttledText = createThrottledValue(displayText)
  const [copied, setCopied] = createSignal(false)

  const handleCopy = async () => {
    const content = displayText()
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Show when={throttledText()}>
      <div data-component="text-part">
        <div data-slot="text-part-body">
          <Markdown text={throttledText()} cacheKey={part.id} />
          <div data-slot="text-part-copy-wrapper">
            <Tooltip value={copied() ? i18n.t("ui.message.copied") : i18n.t("ui.message.copy")}>
              <IconButton
                icon={copied() ? "check" : "copy"}
                variant="secondary"
                onClick={handleCopy}
                aria-label={copied() ? i18n.t("ui.message.copied") : i18n.t("ui.message.copy")}
              />
            </Tooltip>
          </div>
        </div>
      </div>
    </Show>
  )
}
```

### Tool Part Rendering

**Tool Component Registry** (`packages/ui/src/components/message-part.tsx:512-533`):

```typescript
export interface ToolProps {
  input: Record<string, any>;
  metadata: Record<string, any>;
  tool: string;
  output?: string;
  status?: string;
  hideDetails?: boolean;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  locked?: boolean;
}

const state: Record<string, { name: string; render?: ToolComponent }> = {};

export function registerTool(input: { name: string; render?: ToolComponent }) {
  state[input.name] = input;
  return input;
}

export function getTool(name: string) {
  return state[name]?.render;
}

export const ToolRegistry = {
  register: registerTool,
  render: getTool,
};
```

**Tool Part Display** (`packages/ui/src/components/message-part.tsx:534-666`):

```typescript
PART_MAPPING["tool"] = function ToolPartDisplay(props) {
  const data = useData()
  const part = props.part as ToolPart

  // Check for pending permission/question for this tool call
  const permission = createMemo(() => {
    const next = data.store.permission?.[props.message.sessionID]?.[0]
    if (!next || !next.tool) return undefined
    if (next.tool!.callID !== part.callID) return undefined
    return next
  })

  const questionRequest = createMemo(() => {
    const next = data.store.question?.[props.message.sessionID]?.[0]
    if (!next || !next.tool) return undefined
    if (next.tool!.callID !== part.callID) return undefined
    return next
  })

  const [showPermission, setShowPermission] = createSignal(false)
  const [showQuestion, setShowQuestion] = createSignal(false)

  // Show permission UI with slight delay for animation
  createEffect(() => {
    const perm = permission()
    if (perm) {
      const timeout = setTimeout(() => setShowPermission(true), 50)
      onCleanup(() => clearTimeout(timeout))
    } else {
      setShowPermission(false)
    }
  })

  // Get tool-specific renderer or fallback to generic
  const render = ToolRegistry.render(part.tool) ?? GenericTool

  return (
    <div data-component="tool-part-wrapper"
         data-permission={showPermission()}
         data-question={showQuestion()}>
      <Switch>
        <Match when={part.state.status === "error" && part.state.error}>
          {/* Error state */}
          <Card variant="error">
            <div data-component="tool-error">
              <Icon name="circle-ban-sign" size="small" />
              <span data-slot="message-part-tool-error-message">
                {error().replace("Error: ", "")}
              </span>
            </div>
          </Card>
        </Match>
        <Match when={true}>
          {/* Normal tool display */}
          <Dynamic
            component={render}
            input={input()}
            tool={part.tool}
            metadata={metadata()}
            output={part.state.output}
            status={part.state.status}
            hideDetails={props.hideDetails}
            forceOpen={forceOpen()}
            locked={showPermission() || showQuestion()}
            defaultOpen={props.defaultOpen}
          />
        </Match>
      </Switch>

      {/* Permission prompt overlay */}
      <Show when={showPermission() && permission()}>
        <div data-component="permission-prompt">
          <div data-slot="permission-actions">
            <Button variant="ghost" size="small" onClick={() => respond("reject")}>
              {i18n.t("ui.permission.deny")}
            </Button>
            <Button variant="secondary" size="small" onClick={() => respond("always")}>
              {i18n.t("ui.permission.allowAlways")}
            </Button>
            <Button variant="primary" size="small" onClick={() => respond("once")}>
              {i18n.t("ui.permission.allowOnce")}
            </Button>
          </div>
        </div>
      </Show>
    </div>
  )
}
```

### Tool Registration Examples

**Read Tool** (`packages/ui/src/components/message-part.tsx:724-762`):

```typescript
ToolRegistry.register({
  name: "read",
  render(props) {
    const data = useData()
    const i18n = useI18n()
    const args: string[] = []
    if (props.input.offset) args.push("offset=" + props.input.offset)
    if (props.input.limit) args.push("limit=" + props.input.limit)

    const loaded = createMemo(() => {
      if (props.status !== "completed") return []
      const value = props.metadata.loaded
      if (!value || !Array.isArray(value)) return []
      return value.filter((p): p is string => typeof p === "string")
    })

    return (
      <>
        <BasicTool
          {...props}
          icon="glasses"
          trigger={{
            title: i18n.t("ui.tool.read"),
            subtitle: props.input.filePath ? getFilename(props.input.filePath) : "",
            args,
          }}
        />
        <For each={loaded()}>
          {(filepath) => (
            <div data-component="tool-loaded-file">
              <Icon name="enter" size="small" />
              <span>
                {i18n.t("ui.tool.loaded")} {relativizeProjectPaths(filepath, data.directory)}
              </span>
            </div>
          )}
        </For>
      </>
    )
  },
})
```

**Bash Tool** (`packages/ui/src/components/message-part.tsx:1031-1052`):

```typescript
ToolRegistry.register({
  name: "bash",
  render(props) {
    const i18n = useI18n()
    return (
      <BasicTool
        {...props}
        icon="console"
        trigger={{
          title: i18n.t("ui.tool.shell"),
          subtitle: props.input.description,
        }}
      >
        <div data-component="tool-output" data-scrollable>
          <Markdown
            text={`\`\`\`command\n$ ${props.input.command ?? props.metadata.command ?? ""}${
              props.output || props.metadata.output
                ? "\n\n" + stripAnsi(props.output || props.metadata.output)
                : ""
            }\n\`\`\``}
          />
        </div>
      </BasicTool>
    )
  },
})
```

### Assistant Message Display

**Message with Parts** (`packages/ui/src/components/message-part.tsx:291-302`):

```typescript
export function AssistantMessageDisplay(props: { message: AssistantMessage; parts: PartType[] }) {
  const emptyParts: PartType[] = []

  // Filter out internal tools (like todoread)
  const filteredParts = createMemo(
    () =>
      props.parts.filter((x) => {
        return x.type !== "tool" || (x as ToolPart).tool !== "todoread"
      }),
    emptyParts,
    { equals: same },  // Custom equality check
  )

  // Render each part in order
  return <For each={filteredParts()}>{(part) => <Part part={part} message={props.message} />}</For>
}
```

---

## Event System

### Session Events

```typescript
export const Event = {
  Created: BusEvent.define("session.created", z.object({ info: Info })),
  Updated: BusEvent.define("session.updated", z.object({ info: Info })),
  Deleted: BusEvent.define("session.deleted", z.object({ info: Info })),
  Diff: BusEvent.define(
    "session.diff",
    z.object({
      sessionID: z.string(),
      diff: Snapshot.FileDiff.array(),
    })
  ),
  Error: BusEvent.define(
    "session.error",
    z.object({
      sessionID: z.string().optional(),
      error: MessageV2.Assistant.shape.error,
    })
  ),
};
```

### Status Events

```typescript
export const Event = {
  Status: BusEvent.define(
    "session.status",
    z.object({
      sessionID: z.string(),
      status: Info,
    })
  ),
  Idle: BusEvent.define(
    "session.idle",
    z.object({
      sessionID: z.string(),
    })
  ),
};
```

### Permission Events

```typescript
export const Event = {
  Asked: BusEvent.define("permission.asked", Request),
  Replied: BusEvent.define(
    "permission.replied",
    z.object({
      requestID: z.string(),
      reply: Reply,
    })
  ),
  Rejected: BusEvent.define(
    "permission.rejected",
    z.object({
      requestID: z.string(),
    })
  ),
};
```

### Question Events

```typescript
export const Event = {
  Asked: BusEvent.define("question.asked", Request),
  Replied: BusEvent.define(
    "question.replied",
    z.object({
      requestID: z.string(),
      answers: z.array(z.array(z.string())),
    })
  ),
  Rejected: BusEvent.define(
    "question.rejected",
    z.object({
      requestID: z.string(),
    })
  ),
};
```

---

## Storage Layer

### Key Structure

Opencode uses a hierarchical key structure for storage:

```typescript
// Session storage
["session", projectID, sessionID] -> Session.Info

// Message storage
["message", sessionID, messageID] -> MessageV2.Info

// Part storage (separate from messages)
["part", messageID, partID] -> MessageV2.Part
```

### Storage Operations

**Writing Parts** (`packages/opencode/src/session/index.ts:428-437`):

```typescript
export const updatePart = fn(UpdatePartInput, async input => {
  const part = "delta" in input ? input.part : input;
  const delta = "delta" in input ? input.delta : undefined;

  // Write to storage
  await Storage.write(["part", part.messageID, part.id], part);

  // Publish event
  Bus.publish(MessageV2.Event.PartUpdated, {
    part,
    delta,
  });

  return part;
});
```

**Reading Parts** (`packages/opencode/src/session/message-v2.ts:621-629`):

```typescript
export const parts = fn(Identifier.schema("message"), async messageID => {
  const result = [] as MessageV2.Part[];
  for (const item of await Storage.list(["part", messageID])) {
    const read = await Storage.read<MessageV2.Part>(item);
    result.push(read);
  }
  result.sort((a, b) => (a.id > b.id ? 1 : -1));
  return result;
});
```

**Streaming Messages** (`packages/opencode/src/session/message-v2.ts:611-619`):

```typescript
export const stream = fn(Identifier.schema("session"), async function* (sessionID) {
  const list = await Array.fromAsync(await Storage.list(["message", sessionID]));
  for (let i = list.length - 1; i >= 0; i--) {
    yield await get({
      sessionID,
      messageID: list[i][2],
    });
  }
});
```

### Compaction Filtering

**Filter Compacted Messages** (`packages/opencode/src/session/message-v2.ts:644-659`):

```typescript
export async function filterCompacted(stream: AsyncIterable<MessageV2.WithParts>) {
  const result = [] as MessageV2.WithParts[];
  const completed = new Set<string>();

  for await (const msg of stream) {
    result.push(msg);

    // Stop at compaction point
    if (
      msg.info.role === "user" &&
      completed.has(msg.info.id) &&
      msg.parts.some(part => part.type === "compaction")
    )
      break;

    // Mark completed assistant messages
    if (msg.info.role === "assistant" && msg.info.summary && msg.info.finish)
      completed.add(msg.info.parentID);
  }

  result.reverse();
  return result;
}
```

---

## Tool System

### Tool Context

Tools receive a context object with:

```typescript
interface ToolContext {
  sessionID: string;
  messageID: string;
  callID: string;
  agent: string;
  abort: AbortSignal;
  extra: Record<string, any>;
  messages: MessageV2.WithParts[];

  // Update tool metadata during execution
  metadata: (val: { title?: string; metadata?: any }) => Promise<void>;

  // Request permission
  ask: (req: PermissionRequest) => Promise<void>;
}
```

### Tool Registration

**Tool Registry** (`packages/opencode/src/tool/registry.ts`):

```typescript
export namespace ToolRegistry {
  export async function tools(model: { modelID: string; providerID: string }, agent: Agent.Info) {
    // Return available tools based on model capabilities and agent permissions
  }
}
```

### Tool Execution Flow

1. **AI streams tool call** → `tool-input-start` → `tool-call` events
2. **Processor creates ToolPart** with `status: "pending"`
3. **Tool executes** → Updates to `status: "running"`
4. **Tool completes** → Updates to `status: "completed"` with output
5. **Or errors** → Updates to `status: "error"` with error message

**Processor Tool Handling** (`packages/opencode/src/session/processor.ts:103-221`):

```typescript
case "tool-input-start":
  const part = await Session.updatePart({
    id: toolcalls[value.id]?.id ?? Identifier.ascending("part"),
    messageID: input.assistantMessage.id,
    sessionID: input.assistantMessage.sessionID,
    type: "tool",
    tool: value.toolName,
    callID: value.id,
    state: {
      status: "pending",
      input: {},
      raw: "",
    },
  })
  toolcalls[value.id] = part as MessageV2.ToolPart
  break

case "tool-call": {
  const match = toolcalls[value.toolCallId]
  if (match) {
    const part = await Session.updatePart({
      ...match,
      tool: value.toolName,
      state: {
        status: "running",
        input: value.input,
        time: { start: Date.now() },
      },
      metadata: value.providerMetadata,
    })
    toolcalls[value.toolCallId] = part as MessageV2.ToolPart

    // Doom loop detection
    const parts = await MessageV2.parts(input.assistantMessage.id)
    const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD)
    if (
      lastThree.length === DOOM_LOOP_THRESHOLD &&
      lastThree.every(
        (p) =>
          p.type === "tool" &&
          p.tool === value.toolName &&
          p.state.status !== "pending" &&
          JSON.stringify(p.state.input) === JSON.stringify(value.input),
      )
    ) {
      // Ask user about potential infinite loop
      await PermissionNext.ask({
        permission: "doom_loop",
        patterns: [value.toolName],
        sessionID: input.assistantMessage.sessionID,
        metadata: { tool: value.toolName, input: value.input },
        always: [value.toolName],
        ruleset: agent.permission,
      })
    }
  }
  break
}

case "tool-result": {
  const match = toolcalls[value.toolCallId]
  if (match && match.state.status === "running") {
    await Session.updatePart({
      ...match,
      state: {
        status: "completed",
        input: value.input ?? match.state.input,
        output: value.output.output,
        metadata: value.output.metadata,
        title: value.output.title,
        time: {
          start: match.state.time.start,
          end: Date.now(),
        },
        attachments: value.output.attachments,
      },
    })
    delete toolcalls[value.toolCallId]
  }
  break
}
```

---

## Session Management

### Session Structure

```typescript
export const Info = z
  .object({
    id: Identifier.schema("session"),
    slug: z.string(),
    projectID: z.string(),
    directory: z.string(),
    parentID: Identifier.schema("session").optional(),
    summary: z
      .object({
        additions: z.number(),
        deletions: z.number(),
        files: z.number(),
        diffs: Snapshot.FileDiff.array().optional(),
      })
      .optional(),
    share: z
      .object({
        url: z.string(),
      })
      .optional(),
    title: z.string(),
    version: z.string(),
    time: z.object({
      created: z.number(),
      updated: z.number(),
      compacting: z.number().optional(),
      archived: z.number().optional(),
    }),
    permission: PermissionNext.Ruleset.optional(),
    revert: z
      .object({
        messageID: z.string(),
        partID: z.string().optional(),
        snapshot: z.string().optional(),
        diff: z.string().optional(),
      })
      .optional(),
  })
  .meta({ ref: "Session" });
```

### Session Loop

**Main Processing Loop** (`packages/opencode/src/session/prompt.ts:262-644`):

```typescript
export const loop = fn(Identifier.schema("session"), async (sessionID) => {
  const abort = start(sessionID)
  if (!abort) {
    return new Promise<MessageV2.WithParts>((resolve, reject) => {
      const callbacks = state()[sessionID].callbacks
      callbacks.push({ resolve, reject })
    })
  }

  using _ = defer(() => cancel(sessionID))

  let step = 0
  const session = await Session.get(sessionID)

  while (true) {
    SessionStatus.set(sessionID, { type: "busy" })

    // Get messages up to compaction point
    let msgs = await MessageV2.filterCompacted(MessageV2.stream(sessionID))

    // Find last user and assistant messages
    let lastUser: MessageV2.User | undefined
    let lastAssistant: MessageV2.Assistant | undefined
    let lastFinished: MessageV2.Assistant | undefined
    let tasks: (MessageV2.CompactionPart | MessageV2.SubtaskPart)[] = []

    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (!lastUser && msg.info.role === "user")
        lastUser = msg.info as MessageV2.User
      if (!lastAssistant && msg.info.role === "assistant")
        lastAssistant = msg.info as MessageV2.Assistant
      if (!lastFinished && msg.info.role === "assistant" && msg.info.finish)
        lastFinished = msg.info as MessageV2.Assistant
      if (lastUser && lastFinished) break
      const task = msg.parts.filter((part) =>
        part.type === "compaction" || part.type === "subtask"
      )
      if (task && !lastFinished) {
        tasks.push(...task)
      }
    }

    // Exit conditions
    if (!lastUser) throw new Error("No user message found")
    if (
      lastAssistant?.finish &&
      !["tool-calls", "unknown"].includes(lastAssistant.finish) &&
      lastUser.id < lastAssistant.id
    ) {
      log.info("exiting loop", { sessionID })
      break
    }

    step++

    // Handle pending subtasks
    const task = tasks.pop()
    if (task?.type === "subtask") {
      // Execute subtask tool
      // ...
      continue
    }

    // Handle pending compaction
    if (task?.type === "compaction") {
      const result = await SessionCompaction.process({
        messages: msgs,
        parentID: lastUser.id,
        abort,
        sessionID,
        auto: task.auto,
      })
      if (result === "stop") break
      continue
    }

    // Check for context overflow
    if (
      lastFinished &&
      lastFinished.summary !== true &&
      (await SessionCompaction.isOverflow({ tokens: lastFinished.tokens, model }))
    ) {
      await SessionCompaction.create({
        sessionID,
        agent: lastUser.agent,
        model: lastUser.model,
        auto: true,
      })
      continue
    }

    // Normal AI processing
    const processor = SessionProcessor.create({
      assistantMessage: (await Session.updateMessage({
        id: Identifier.ascending("message"),
        parentID: lastUser.id,
        role: "assistant",
        // ...
      })) as MessageV2.Assistant,
      sessionID: sessionID,
      model,
      abort,
    })

    const result = await processor.process({
      user: lastUser,
      agent,
      abort,
      sessionID,
      system: [...],
      messages: [...],
      tools,
      model,
    })

    if (result === "stop") break
    if (result === "compact") {
      // Trigger compaction
    }
  }

  // Return final assistant message
  for await (const item of MessageV2.stream(sessionID)) {
    if (item.info.role === "user") continue
    const queued = state()[sessionID]?.callbacks ?? []
    for (const q of queued) {
      q.resolve(item)
    }
    return item
  }
})
```

---

## Key Insights for ekacode

### 1. Unified Part Model

**Opencode's approach:** All content types (text, tools, reasoning) are "parts" in a single array within one assistant message.

**Benefits:**

- No artificial splitting of text around tool calls
- Natural ordering: text → tool → text → tool → text all in one message
- Simple rendering: iterate parts array, render each by type
- Easy to add new part types without changing message structure

**For ekacode:**

```typescript
// Instead of three separate messages:
// - preambleMessageId (text before tools)
// - activityMessageId (tool calls)
// - finalMessageId (text after tools)

// Use one message with parts:
interface AssistantMessage {
  id: string;
  role: "assistant";
  parts: Array<
    | { type: "text"; content: string; time: { start: number; end?: number } }
    | { type: "tool_call"; tool: string; input: any; output?: any; status: string }
    | { type: "reasoning"; content: string }
  >;
}
```

### 2. Explicit Timestamps

**Opencode's approach:** Every part has `time.start` and optional `time.end`.

**Benefits:**

- UI can show streaming indicators while `end` is undefined
- Calculate duration for analytics
- Detect long gaps between chunks
- Know when content is "complete" vs "streaming"

**For ekacode:**

```typescript
interface PartBase {
  id: string;
  time: {
    start: number; // When streaming started
    end?: number; // Undefined = still streaming
  };
}

// In UI:
const isStreaming = () => !part.time.end;
const duration = () =>
  part.time.end ? part.time.end - part.time.start : Date.now() - part.time.start;
```

### 3. Event-Driven Architecture

**Opencode's approach:** SSE with typed events, no polling.

**Benefits:**

- Real-time updates without polling overhead
- Simple mental model: events flow from server → client
- Easy to extend: add new event types without breaking existing code
- Heartbeat prevents connection timeouts

**For ekacode:**

```typescript
// Server endpoint
app.get("/events", c => {
  return streamSSE(c, async stream => {
    const unsub = eventBus.subscribe(event => {
      stream.writeSSE({ data: JSON.stringify(event) });
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: "heartbeat" }) });
    }, 30000);

    stream.onAbort(() => {
      clearInterval(heartbeat);
      unsub();
    });
  });
});

// Client
const es = new EventSource("/events");
es.onmessage = e => {
  const event = JSON.parse(e.data);
  updateStore(event);
};
```

### 4. Normalized Storage

**Opencode's approach:** Parts stored separately from messages, keyed by message ID.

**Benefits:**

- Efficient updates: only write changed part, not entire message
- Large parts (file contents) don't bloat message queries
- Can load message list without loading all parts
- Parts can be updated independently

**For ekacode:**

```typescript
// Storage structure:
{
  messages: {
    [sessionId]: Message[]
  },
  parts: {
    [messageId]: Part[]  // Normalized
  }
}

// Update only a part:
async function updatePart(part: Part) {
  await db.set(`parts:${part.messageId}:${part.id}`, part)
  eventBus.emit({ type: 'part.updated', part })
}
```

### 5. Throttled Rendering

**Opencode's approach:** 100ms throttle on text updates to prevent UI jank.

**Benefits:**

- Smooth UI even with rapid text deltas
- Reduces re-render frequency
- Still feels responsive (100ms is imperceptible)

**For ekacode:**

```typescript
function useThrottledValue<T>(getValue: () => T, delay = 100) {
  const [value, setValue] = useState(getValue());
  let timeout: NodeJS.Timeout;
  let lastUpdate = 0;

  useEffect(() => {
    const next = getValue();
    const now = Date.now();
    const remaining = delay - (now - lastUpdate);

    if (remaining <= 0) {
      lastUpdate = now;
      setValue(next);
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        lastUpdate = Date.now();
        setValue(next);
      }, remaining);
    }

    return () => clearTimeout(timeout);
  });

  return value;
}
```

### 6. Tool State Machine

**Opencode's approach:** Tools have explicit states: `pending` → `running` → `completed` | `error`

**Benefits:**

- UI can show appropriate UI for each state
- Easy to track tool lifecycle
- Can render loading spinners, results, or errors
- State transitions are explicit and logged

**For ekacode:**

```typescript
type ToolState =
  | { status: 'pending'; input: any }
  | { status: 'running'; input: any; time: { start: number } }
  | { status: 'completed'; input: any; output: any; time: { start: number; end: number } }
  | { status: 'error'; input: any; error: string; time: { start: number; end: number } }

// In UI:
switch (part.state.status) {
  case 'pending':
    return <ToolPending tool={part.tool} />
  case 'running':
    return <ToolRunning tool={part.tool} />
  case 'completed':
    return <ToolResult tool={part.tool} output={part.state.output} />
  case 'error':
    return <ToolError tool={part.tool} error={part.state.error} />
}
```

### 7. Handling the "26-Second Gap"

**Problem:** AI sends text, then 26 seconds later sends more text. Should this be one message or two?

**Opencode's solution:** Keep as one message with one text part. The `time` field tracks streaming state.

**Alternative approaches:**

**Option A: Single Part (Opencode's approach)**

```typescript
// Text part continues streaming
{
  type: "text",
  text: "Initial text... [26 second pause] ...continued text",
  time: { start: 1000, end: 27000 }  // end set when fully complete
}
```

**Option B: Split Parts with Gap Metadata**

```typescript
// Split into multiple text parts when gap > threshold
{
  type: "text",
  text: "Initial text...",
  time: { start: 1000, end: 2000 }
},
{
  type: "gap",
  duration: 26000,
  time: { start: 2000, end: 28000 }
},
{
  type: "text",
  text: "Continued text...",
  time: { start: 28000, end: 29000 }
}
```

**Option C: Single Part with Gap Annotations**

```typescript
{
  type: "text",
  text: "Initial text... Continued text...",
  time: { start: 1000, end: 29000 },
  metadata: {
    gaps: [
      { start: 2000, end: 28000, duration: 26000 }
    ]
  }
}
```

**Recommendation for ekacode:** Use Option A (Opencode's approach) for simplicity. If you need to show gap indicators in UI, add metadata to the text part.

### 8. Component Registry Pattern

**Opencode's approach:** Dynamic component registry for parts and tools.

**Benefits:**

- Extensible: plugins can register new part/tool renderers
- Clean separation: part type → component mapping
- Easy to override specific tool UIs

**For ekacode:**

```typescript
// Part registry
const partRenderers: Record<string, Component> = {
  text: TextPart,
  tool: ToolPart,
  reasoning: ReasoningPart,
}

// Tool registry
const toolRenderers: Record<string, Component> = {
  read: ReadTool,
  bash: BashTool,
  edit: EditTool,
}

// Usage:
function Part({ part }: { part: Part }) {
  const Renderer = partRenderers[part.type] || DefaultPart
  return <Renderer part={part} />
}

function ToolPart({ part }: { part: ToolPart }) {
  const Renderer = toolRenderers[part.tool] || GenericTool
  return <Renderer tool={part} />
}
```

### 9. Permission Integration

**Opencode's approach:** Permission requests are events that reference specific tool calls via `callID`.

**Benefits:**

- UI can show permission prompt inline with tool
- Can correlate permission response with specific tool execution
- Supports "always allow" by storing in session permissions

**For ekacode:**

```typescript
// Permission request
interface PermissionRequest {
  id: string
  sessionID: string
  tool: {
    messageID: string
    callID: string  // Links to specific tool call
  }
  permission: string
  patterns: string[]
}

// In UI:
const permission = createMemo(() => {
  const requests = store.permissions[props.message.sessionID]
  return requests.find(p => p.tool?.callID === part.callID)
})

// Show permission UI inline with tool
<Show when={permission()}>
  <PermissionPrompt request={permission()} />
</Show>
```

### 10. Session Status Management

**Opencode's approach:** Centralized status tracking with events.

**Status Types:**

- `idle` - Not processing
- `busy` - Processing AI response
- `retry` - Retrying after error

**For ekacode:**

```typescript
type SessionStatus =
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; attempt: number; message: string; next: number };

// Update status
SessionStatus.set(sessionID, { type: "busy" });

// Subscribe to changes
Bus.subscribe(SessionStatus.Event.Status, ({ sessionID, status }) => {
  updateStore(sessionID, status);
});
```

---

## Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (UI)                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   EventSource   │  │   Data Store    │  │    Part Components      │ │
│  │   (SSE Client)  │──│  (Normalized)   │──│  (Text/Tool/Reasoning)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│           │                    │                       │                │
│           │ 1. Receive events  │ 2. Update store       │ 3. Re-render   │
│           │                    │                       │                │
└───────────┼────────────────────┼───────────────────────┼────────────────┘
            │                    │                       │
            │ SSE /event         │                       │
            ▼                    │                       │
┌─────────────────────────────────────────────────────────────────────────┐
│                              SERVER                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   SSE Endpoint  │  │   Event Bus     │  │    Session Processor    │ │
│  │  streamSSE()    │──│  Bus.publish()  │──│   (AI Stream Handler)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│           ▲                                              │              │
│           │                                              │              │
│           │         ┌─────────────────┐                  │              │
│           │         │   AI SDK Stream │◀─────────────────┘              │
│           │         │  streamText()   │                                 │
│           │         └─────────────────┘                                 │
│           │                      │                                      │
│           │         ┌────────────┴────────────┐                        │
│           │         │    Stream Events        │                        │
│           │         │  text-delta, tool-call, │                        │
│           │         │  tool-result, finish    │                        │
│           │         └─────────────────────────┘                        │
└───────────┼────────────────────────────────────────────────────────────┘
            │
            │ Storage Operations
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            STORAGE                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   Sessions      │  │    Messages     │  │        Parts            │ │
│  │ [session, pid,  │  │ [message, sid,  │  │   [part, mid, pid]      │ │
│  │   sid]          │  │   mid]          │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

Opencode's architecture is built on these key principles:

1. **Parts over Messages** - One assistant message contains all content as typed parts
2. **Events over Callbacks** - SSE with typed events for all state changes
3. **Normalized Storage** - Parts stored separately, updated independently
4. **Explicit Timestamps** - Every part tracks start/end times
5. **Throttled Rendering** - 100ms throttle prevents UI jank
6. **State Machines** - Tools have explicit states (pending→running→completed/error)
7. **Component Registry** - Dynamic mapping of types to renderers
8. **Permission Integration** - Inline permission requests linked to tool calls

This architecture elegantly handles:

- Long gaps between text chunks (timestamps show streaming state)
- Multiple tool calls in one response (array of tool parts)
- Real-time updates (SSE events)
- Extensibility (register new part/tool types)
- Performance (throttled rendering, normalized storage)
