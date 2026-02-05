import { writeFile } from "node:fs/promises";
import { parseUIMessageStream } from "../apps/desktop/src/lib/chat/stream-parser.ts";
import { startServer } from "../packages/server/src/index.ts";

const workspace = process.cwd();
const prompt = "Trace stream order and routing";

function b64(value: string) {
  return Buffer.from(value, "utf-8").toString("base64");
}

const trace: Array<{
  index: number;
  streamType: string;
  streamId?: string;
  toolCallId?: string;
  routedMessage?: string;
  routeReason?: string;
  note?: string;
}> = [];

let index = 0;
let preambleId: string | null = null;
let activityId: string | null = null;
let finalId: string | null = null;
let hasToolCalls = false;
let bufferedText = "";
let msgCounter = 0;

const messageParts: Record<string, string[]> = {};
const messageKind: Record<string, string> = {};

function ensureMessage(kind: "preamble" | "activity" | "final") {
  if (kind === "preamble" && !preambleId) {
    preambleId = `preamble_${++msgCounter}`;
    messageKind[preambleId] = "preamble";
    messageParts[preambleId] = [];
  }
  if (kind === "activity" && !activityId) {
    activityId = `activity_${++msgCounter}`;
    messageKind[activityId] = "activity";
    messageParts[activityId] = [];
  }
  if (kind === "final" && !finalId) {
    finalId = `final_${++msgCounter}`;
    messageKind[finalId] = "final";
    messageParts[finalId] = [];
  }
  return kind === "preamble" ? preambleId : kind === "activity" ? activityId : finalId;
}

function pushTrace(entry: Omit<(typeof trace)[number], "index">) {
  trace.push({ index: ++index, ...entry });
}

function addPart(targetId: string | null, label: string) {
  if (!targetId) return;
  if (!messageParts[targetId]) messageParts[targetId] = [];
  messageParts[targetId].push(label);
}

async function run(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: prompt,
      workspace,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  await parseUIMessageStream(response, {
    onMessageStart: messageId => {
      pushTrace({
        streamType: "message-start",
        streamId: messageId,
        note: "stream message started",
      });
    },
    onTextDelta: (messageId, delta) => {
      if (!hasToolCalls) {
        const targetId = ensureMessage("preamble");
        addPart(targetId, `text-delta(${delta.length})`);
        pushTrace({
          streamType: "text-delta",
          streamId: messageId,
          routedMessage: targetId ?? undefined,
          routeReason: "no tool calls yet → preamble",
          note: `deltaLength=${delta.length}`,
        });
      } else {
        bufferedText += delta;
        pushTrace({
          streamType: "text-delta",
          streamId: messageId,
          routedMessage: "(buffered)",
          routeReason: "tool calls already seen → buffer for final",
          note: `deltaLength=${delta.length}`,
        });
      }
    },
    onToolCallStart: toolCall => {
      hasToolCalls = true;
      const targetId = ensureMessage("activity");
      addPart(targetId, `tool-call(${toolCall.toolName})`);
      pushTrace({
        streamType: "tool-call",
        toolCallId: toolCall.toolCallId,
        routedMessage: targetId ?? undefined,
        routeReason: "tool-call → activity message",
        note: `toolName=${toolCall.toolName}`,
      });
    },
    onToolCallEnd: toolCallId => {
      const targetId = ensureMessage("activity");
      addPart(targetId, `tool-call-args(${toolCallId})`);
      pushTrace({
        streamType: "tool-input-end",
        toolCallId,
        routedMessage: targetId ?? undefined,
        routeReason: "tool-call args finalize → activity",
      });
    },
    onToolResult: result => {
      const targetId = ensureMessage("activity");
      addPart(targetId, `tool-result(${result.toolCallId})`);
      pushTrace({
        streamType: "tool-result",
        toolCallId: result.toolCallId,
        routedMessage: targetId ?? undefined,
        routeReason: "tool-result → activity",
      });
    },
    onDataPart: (type, id, _data, transient) => {
      if (type === "data-session") {
        pushTrace({ streamType: type, streamId: id, note: "session metadata" });
        return;
      }

      const isUiData = type.startsWith("data-");
      const targetId = isUiData ? ensureMessage("activity") : ensureMessage("preamble");
      addPart(targetId, `${type}(${id})${transient ? ":transient" : ""}`);

      const reason = isUiData ? "data-* → activity" : "non-data → preamble";
      pushTrace({
        streamType: type,
        streamId: id,
        routedMessage: targetId ?? undefined,
        routeReason: reason,
        note: transient ? "transient" : undefined,
      });
    },
    onComplete: finishReason => {
      if (bufferedText.trim()) {
        const targetId = ensureMessage("final");
        addPart(targetId, `final-text(${bufferedText.length})`);
        pushTrace({
          streamType: "text-final",
          routedMessage: targetId ?? undefined,
          routeReason: "buffer flushed → final message",
          note: `bufferedLength=${bufferedText.length}`,
        });
      }

      pushTrace({ streamType: "finish", note: `finishReason=${finishReason}` });
    },
    onError: error => {
      pushTrace({ streamType: "error", note: error.message });
    },
  });
}

async function main() {
  const { server, port, token } = await startServer();
  const url = `http://127.0.0.1:${port}/api/chat`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Basic ${b64(`admin:${token}`)}`,
  };

  try {
    await run(url, headers);
  } finally {
    server.close();
  }

  const traceLines = [
    "# Stream Trace",
    `Prompt: ${prompt}`,
    `Workspace: ${workspace}`,
    "",
    "## Stream Order + Routing",
    "| # | streamType | streamId/toolCallId | routedMessage | reason | note |",
    "|---:|---|---|---|---|---|",
    ...trace.map(t => {
      const id = t.toolCallId ?? t.streamId ?? "";
      return `| ${t.index} | ${t.streamType} | ${id} | ${t.routedMessage ?? ""} | ${t.routeReason ?? ""} | ${t.note ?? ""} |`;
    }),
    "",
    "## Message Buckets",
    ...Object.keys(messageParts).map(id => {
      const kind = messageKind[id] ?? "unknown";
      const parts = messageParts[id].map(p => `- ${p}`).join("\n");
      return `### ${id} (${kind})\n${parts}`;
    }),
    "",
  ].join("\n");

  const outPath = `logs/stream-trace-${Date.now()}.md`;
  await writeFile(outPath, traceLines, "utf-8");

  console.log(`Trace written to ${outPath}`);
}

main().catch(error => {
  console.error("Trace failed", error);
  process.exitCode = 1;
});
