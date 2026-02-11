/**
 * Chat Stream Fixtures
 *
 * Shared fixtures for testing chat stream parsing.
 * Based on real AI SDK UIMessage stream protocol.
 */

export interface StreamEvent {
  type: string;
  id?: string;
  delta?: string;
  finishReason?: string;
  error?: string;
  data?: unknown;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  transient?: boolean;
}

export interface StreamFixture {
  name: string;
  description: string;
  sessionId: string;
  messageId: string;
  chunks: string[];
  expectedEvents: StreamEvent[];
}

// UUIDv7 format IDs for fixtures
const SESSION_ID = "0194e2c0-5c7a-7b8c-9d0e-1f2a3b4c5d6e";
const ASSISTANT_MESSAGE_ID = "0194e2c0-5c7a-7b8c-9d0e-1f2a3b4c5d70";

/**
 * Simple text response fixture
 * Basic assistant response with text deltas and finish
 */
export const simpleTextFixture: StreamFixture = {
  name: "simple-text-response",
  description: "Single text-delta with finish event",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"Hello"}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":" world"}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"!"}\n\n`,
    `data: {"type":"finish","finishReason":"stop"}\n\n`,
  ],
  expectedEvents: [
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "Hello" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: " world" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "!" },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * Multi-delta text fixture
 * Multiple small text deltas to test incremental rendering
 */
export const multiDeltaFixture: StreamFixture = {
  name: "multi-delta-text",
  description: "Multiple small text deltas",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"The"}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":" quick"}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":" brown"}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":" fox"}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":" jumps"}\n\n`,
    `data: {"type":"finish","finishReason":"stop"}\n\n`,
  ],
  expectedEvents: [
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "The" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: " quick" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: " brown" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: " fox" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: " jumps" },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * Tool call fixture
 * Tool call start, args streaming, and result
 */
const TOOL_CALL_ID = "call_12345";

export const toolCallFixture: StreamFixture = {
  name: "tool-call-flow",
  description: "Tool call with args and result",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"tool-call","id":"${ASSISTANT_MESSAGE_ID}","toolCallId":"${TOOL_CALL_ID}","toolName":"read_file","args":{"path":"/README.md"}}\n\n`,
    `data: {"type":"tool-result","id":"${ASSISTANT_MESSAGE_ID}","toolCallId":"${TOOL_CALL_ID}","result":{"content":"# Project README"}}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"Based on the README"}\n\n`,
    `data: {"type":"finish","finishReason":"stop"}\n\n`,
  ],
  expectedEvents: [
    {
      type: "tool-call",
      id: ASSISTANT_MESSAGE_ID,
      toolCallId: TOOL_CALL_ID,
      toolName: "read_file",
      args: { path: "/README.md" },
    },
    {
      type: "tool-result",
      id: ASSISTANT_MESSAGE_ID,
      toolCallId: TOOL_CALL_ID,
      result: { content: "# Project README" },
    },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "Based on the README" },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * Reasoning/thinking fixture
 * Reasoning events for planning mode
 */
const REASONING_ID = "reason_001";

export const reasoningFixture: StreamFixture = {
  name: "reasoning-flow",
  description: "Reasoning/thinking events",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"data-thought","id":"${REASONING_ID}","data":{"id":"${REASONING_ID}","status":"thinking","text":"","agentId":"agent-1"}}\n\n`,
    `data: {"type":"data-thought","id":"${REASONING_ID}","data":{"id":"${REASONING_ID}","status":"thinking","text":"Let me analyze","agentId":"agent-1"}}\n\n`,
    `data: {"type":"data-thought","id":"${REASONING_ID}","data":{"id":"${REASONING_ID}","status":"thinking","text":"Let me analyze the codebase","agentId":"agent-1"}}\n\n`,
    `data: {"type":"data-thought","id":"${REASONING_ID}","data":{"id":"${REASONING_ID}","status":"complete","durationMs":1500,"agentId":"agent-1"}}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"After analyzing"}\n\n`,
    `data: {"type":"finish","finishReason":"stop"}\n\n`,
  ],
  expectedEvents: [
    {
      type: "data-thought",
      id: REASONING_ID,
      data: { id: REASONING_ID, status: "thinking", text: "", agentId: "agent-1" },
    },
    {
      type: "data-thought",
      id: REASONING_ID,
      data: { id: REASONING_ID, status: "thinking", text: "Let me analyze", agentId: "agent-1" },
    },
    {
      type: "data-thought",
      id: REASONING_ID,
      data: {
        id: REASONING_ID,
        status: "thinking",
        text: "Let me analyze the codebase",
        agentId: "agent-1",
      },
    },
    {
      type: "data-thought",
      id: REASONING_ID,
      data: { id: REASONING_ID, status: "complete", durationMs: 1500, agentId: "agent-1" },
    },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "After analyzing" },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * Error finish fixture
 * Error event followed by finish
 */
export const errorFinishFixture: StreamFixture = {
  name: "error-finish",
  description: "Error event with finish",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"Let me"}\n\n`,
    `data: {"type":"error","error":"Model unavailable"}\n\n`,
    `data: {"type":"finish","finishReason":"error"}\n\n`,
  ],
  expectedEvents: [
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "Let me" },
    { type: "error", error: "Model unavailable" },
    { type: "finish", finishReason: "error" },
  ],
};

/**
 * Data state fixture
 * State updates during agent execution
 */
export const dataStateFixture: StreamFixture = {
  name: "data-state-updates",
  description: "State updates during execution",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"data-state","id":"state","data":{"state":"running","iteration":0,"toolExecutionCount":0}}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"Processing"}\n\n`,
    `data: {"type":"data-state","id":"state","data":{"state":"running","iteration":1,"toolExecutionCount":1}}\n\n`,
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":" complete"}\n\n`,
    `data: {"type":"data-state","id":"state","data":{"state":"completed","iteration":1,"toolExecutionCount":1}}\n\n`,
    `data: {"type":"finish","finishReason":"stop"}\n\n`,
  ],
  expectedEvents: [
    {
      type: "data-state",
      id: "state",
      data: { state: "running", iteration: 0, toolExecutionCount: 0 },
    },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "Processing" },
    {
      type: "data-state",
      id: "state",
      data: { state: "running", iteration: 1, toolExecutionCount: 1 },
    },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: " complete" },
    {
      type: "data-state",
      id: "state",
      data: { state: "completed", iteration: 1, toolExecutionCount: 1 },
    },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * Raw protocol fixture (AI SDK internal format)
 * Tests parsing of raw protocol lines (0:, b:, d:, e:)
 */
export const rawProtocolFixture: StreamFixture = {
  name: "raw-protocol",
  description: "AI SDK raw protocol format",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: ['0:"Hello"\n', '0:" world"\n', 'd:{"finishReason":"stop"}\n'],
  expectedEvents: [
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "Hello" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: " world" },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * Partial chunk fixture
 * Tests handling of partial events across chunk boundaries
 */
export const partialChunkFixture: StreamFixture = {
  name: "partial-chunks",
  description: "Events split across multiple chunks",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"Hello`,
    ` world"}\n\ndata: {"type":"text-delta","id":"${ASSISTANT_MESSAGE_ID}","delta":"!"}\n\n`,
    `data: {"type":"finish","`,
    `finishReason":"stop"}\n\n`,
  ],
  expectedEvents: [
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "Hello world" },
    { type: "text-delta", id: ASSISTANT_MESSAGE_ID, delta: "!" },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * Mixed data events fixture
 * Various data-* event types
 */
export const mixedDataEventsFixture: StreamFixture = {
  name: "mixed-data-events",
  description: "Various data-* event types",
  sessionId: SESSION_ID,
  messageId: ASSISTANT_MESSAGE_ID,
  chunks: [
    `data: {"type":"data-mode-metadata","id":"${ASSISTANT_MESSAGE_ID}","data":{"mode":"planning","runId":"run_123","startedAt":1704067200000}}\n\n`,
    `data: {"type":"data-run","id":"run_123","data":{"runId":"run_123","title":"Planning","status":"planning","filesEditedOrder":[],"groupsOrder":["group_1"]}}\n\n`,
    `data: {"type":"data-run-group","id":"group_1","data":{"id":"group_1","index":1,"title":"Progress","collapsed":false,"itemsOrder":[]}}\n\n`,
    `data: {"type":"data-action","id":"action_1","data":{"id":"action_1","ts":1704067200000,"kind":"analyzed","title":"Read file.ts","toolCallId":"call_1"}}\n\n`,
    `data: {"type":"finish","finishReason":"stop"}\n\n`,
  ],
  expectedEvents: [
    {
      type: "data-mode-metadata",
      id: ASSISTANT_MESSAGE_ID,
      data: { mode: "planning", runId: "run_123", startedAt: 1704067200000 },
    },
    {
      type: "data-run",
      id: "run_123",
      data: {
        runId: "run_123",
        title: "Planning",
        status: "planning",
        filesEditedOrder: [],
        groupsOrder: ["group_1"],
      },
    },
    {
      type: "data-run-group",
      id: "group_1",
      data: { id: "group_1", index: 1, title: "Progress", collapsed: false, itemsOrder: [] },
    },
    {
      type: "data-action",
      id: "action_1",
      data: {
        id: "action_1",
        ts: 1704067200000,
        kind: "analyzed",
        title: "Read file.ts",
        toolCallId: "call_1",
      },
    },
    { type: "finish", finishReason: "stop" },
  ],
};

/**
 * All fixtures export
 */
export const allFixtures: StreamFixture[] = [
  simpleTextFixture,
  multiDeltaFixture,
  toolCallFixture,
  reasoningFixture,
  errorFinishFixture,
  dataStateFixture,
  rawProtocolFixture,
  partialChunkFixture,
  mixedDataEventsFixture,
];

/**
 * Get fixture by name
 */
export function getFixture(name: string): StreamFixture | undefined {
  return allFixtures.find(f => f.name === name);
}

/**
 * Convert fixture chunks to Uint8Array for testing
 */
export function fixtureToUint8Arrays(fixture: StreamFixture): Uint8Array[] {
  return fixture.chunks.map(chunk => new TextEncoder().encode(chunk));
}

/**
 * Create a mock stream reader from fixture
 */
export function createMockStreamReader(
  fixture: StreamFixture
): ReadableStreamDefaultReader<Uint8Array> {
  const chunks = fixtureToUint8Arrays(fixture);
  let index = 0;

  return {
    read: async () => {
      if (index >= chunks.length) {
        return { done: true, value: undefined };
      }
      return { done: false, value: chunks[index++] };
    },
    releaseLock: () => {},
    cancel: async () => {},
  } as ReadableStreamDefaultReader<Uint8Array>;
}
