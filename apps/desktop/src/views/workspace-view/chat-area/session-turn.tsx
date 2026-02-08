import type { Part as CorePart } from "@ekacode/core/chat";
import { Binary } from "@ekacode/shared/binary";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
  type Component,
} from "solid-js";
import { MessageBubble } from "./message-bubble";
import { AssistantMessage } from "/@/components/assistant-message";
import { Markdown } from "/@/components/markdown";
import { cn } from "/@/lib/utils";
import type { Message, Part } from "/@/providers/global-sync-provider";
import { useSync } from "/@/providers/sync-provider";

interface SessionTurnProps {
  sessionID?: string;
  /** User message ID - component fetches data from store */
  messageID: string;
  /** Whether this turn is the last (for expanded state) */
  isLast?: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  class?: string;
}

// Stable empty arrays to prevent re-renders from new array references
const EMPTY_MESSAGES: Message[] = [];

// Custom equality function to prevent re-renders when array content is unchanged
function arraysEqual<T extends { info?: { id?: string }; id?: string }>(
  a: readonly T[],
  b: readonly T[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const other = b[i];
    const xId = x.info?.id ?? x.id;
    const otherId = other?.info?.id ?? other?.id;
    return xId === otherId;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapError(input: string): string {
  const text = input.replace(/^Error:\s*/, "").trim();
  const parse = (value: string) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  };
  const read = (value: string) => {
    const first = parse(value);
    if (typeof first !== "string") return first;
    return parse(first.trim());
  };

  let json = read(text);
  if (json === undefined) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      json = read(text.slice(start, end + 1));
    }
  }
  if (!isRecord(json)) return text;

  const error = isRecord(json.error) ? json.error : undefined;
  if (error) {
    const type = typeof error.type === "string" ? error.type : undefined;
    const message = typeof error.message === "string" ? error.message : undefined;
    if (type && message) return `${type}: ${message}`;
    if (message) return message;
    if (type) return type;
    const code = typeof error.code === "string" ? error.code : undefined;
    if (code) return code;
  }
  if (typeof json.message === "string") return json.message;
  if (typeof json.error === "string") return json.error;
  return text;
}

function truncate(value: string, max = 60): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function computeStatusFromPart(part: CorePart | undefined): string | undefined {
  if (!part) return undefined;
  if (part.type === "tool") {
    switch (part.tool) {
      case "task":
        return "Delegating task";
      case "todowrite":
      case "todoread":
        return "Planning";
      case "read":
        return "Gathering context";
      case "list":
      case "grep":
      case "glob":
        return "Searching codebase";
      case "webfetch":
        return "Searching web";
      case "edit":
      case "write":
      case "apply_patch":
        return "Making edits";
      case "bash":
        return "Running commands";
      default:
        return undefined;
    }
  }
  if (part.type === "reasoning") {
    const text = part.text ?? "";
    const match = text.trimStart().match(/^\*\*(.+?)\*\*/);
    if (match?.[1]) return `Thinking: ${match[1].trim()}`;
    return "Thinking";
  }
  if (part.type === "text") {
    return "Gathering thoughts";
  }
  return undefined;
}

// Helper to get parts - prefers store parts, falls back to message.parts
function getParts(msg: Message, partStore: Record<string, Part[] | undefined>): Part[] {
  const storeParts = partStore[msg.info.id];
  if (storeParts && storeParts.length > 0) return storeParts;
  return msg.parts ?? [];
}

function runningTaskSessionID(
  messages: Message[],
  partStore: Record<string, Part[] | undefined>
): string | undefined {
  for (let mi = messages.length - 1; mi >= 0; mi -= 1) {
    const msg = messages[mi];
    const parts = getParts(msg, partStore);
    for (let pi = parts.length - 1; pi >= 0; pi -= 1) {
      const part = parts[pi] as unknown as CorePart;
      if (part.type !== "tool" || part.tool !== "task") continue;
      if (part.state.status !== "running") continue;
      const metadata = isRecord(part.state.metadata) ? part.state.metadata : undefined;
      const sessionID = metadata?.sessionId;
      if (typeof sessionID === "string" && sessionID.length > 0) {
        return sessionID;
      }
    }
  }
  return undefined;
}

function hasSteps(messages: Message[], partStore: Record<string, Part[] | undefined>): boolean {
  return messages.some(message => {
    const parts = getParts(message, partStore);
    return parts.some(part => part.type === "tool");
  });
}

function readTime(meta: unknown, key: "startedAt" | "finishedAt"): number | undefined {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === "number" ? value : undefined;
}

function formatDuration(input: { from?: number; to?: number }): string {
  const from = input.from ?? Date.now();
  const to = input.to ?? Date.now();
  const seconds = Math.max(0, Math.round((to - from) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function lastTextPart(
  messages: Message[],
  partStore: Record<string, Part[] | undefined>
): { id?: string; text: string } {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const parts = getParts(msg, partStore);
    for (let p = parts.length - 1; p >= 0; p -= 1) {
      const part = parts[p] as unknown as CorePart;
      if (part.type !== "text") continue;
      const text = typeof part.text === "string" ? part.text.trim() : "";
      if (text) {
        return {
          id: part.id,
          text,
        };
      }
    }
  }
  return { text: "" };
}

export const SessionTurn: Component<SessionTurnProps> = props => {
  const sync = useSync();
  const [retrySeconds, setRetrySeconds] = createSignal(0);
  const [statusText, setStatusText] = createSignal("Considering next steps");
  const [durationText, setDurationText] = createSignal("0s");
  const [copied, setCopied] = createSignal(false);

  let lastStatusAt = Date.now();
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  // ============================================================
  // Fetch user message and assistant messages from store
  // ============================================================

  const userMessage = createMemo(() => {
    const sessionID = props.sessionID;
    if (!sessionID) return undefined;
    const messages = sync.data.message[sessionID] ?? EMPTY_MESSAGES;
    const result = Binary(messages, props.messageID, (m: Message) => m.info.id);
    if (result.found) return messages[result.index];
    return undefined;
  });

  const assistantMessages = createMemo(
    () => {
      const sessionID = props.sessionID;
      if (!sessionID) return EMPTY_MESSAGES;
      const messages = sync.data.message[sessionID] ?? EMPTY_MESSAGES;

      // Find all assistant messages with parentID matching this user message
      const result: Message[] = [];
      for (const msg of messages) {
        if (msg.info.role !== "assistant") continue;
        const info = msg.info as { parentID?: string };
        if (info.parentID === props.messageID) {
          result.push(msg);
        }
      }
      return result.length > 0 ? result : EMPTY_MESSAGES;
    },
    EMPTY_MESSAGES,
    { equals: arraysEqual }
  );

  // Parts accessor from store
  const partStore = createMemo(() => sync.data.part);

  // Compute session status for working/retry state
  const sessionStatus = createMemo(() => {
    const id = props.sessionID;
    if (!id) return { type: "idle" } as const;
    return sync.data.sessionStatus[id]?.status ?? ({ type: "idle" } as const);
  });

  const working = createMemo(() => {
    if (!props.isLast) return false;
    const status = sessionStatus();
    return status.type !== "idle";
  });

  const retry = createMemo(() => {
    if (!props.isLast) return undefined;
    const status = sessionStatus();
    if (status.type === "retry") return status;
    return undefined;
  });

  // ============================================================
  // Derived state from messages
  // ============================================================

  const responsePart = createMemo(() => lastTextPart(assistantMessages(), partStore()));
  const responseText = createMemo(() => responsePart().text);
  const responsePartID = createMemo(() => responsePart().id);
  const hasToolSteps = createMemo(() => hasSteps(assistantMessages(), partStore()));
  const showTrigger = createMemo(() => working() || hasToolSteps());
  const lastAssistantID = createMemo(() => assistantMessages().at(-1)?.info.id);
  const hideResponsePart = createMemo(() => !working() && !!responsePartID());

  const permissions = createMemo(() => {
    if (!props.sessionID) return [];
    return sync.data.permission[props.sessionID] ?? [];
  });

  const questions = createMemo(() => {
    if (!props.sessionID) return [];
    return sync.data.question[props.sessionID] ?? [];
  });

  const hidden = createMemo(() => {
    const out: Array<{ messageID: string; callID: string }> = [];
    const permission = permissions()[0];
    if (permission?.tool) out.push(permission.tool);
    const question = questions()[0];
    if (question?.tool) out.push(question.tool);
    return out;
  });

  const rawStatus = createMemo(() => {
    const taskSessionID = runningTaskSessionID(assistantMessages(), partStore());
    if (taskSessionID) {
      const taskMessages = sync.data.message[taskSessionID] ?? [];
      for (let mi = taskMessages.length - 1; mi >= 0; mi -= 1) {
        const taskMessage = taskMessages[mi];
        if (taskMessage?.info.role !== "assistant") continue;
        const taskParts = sync.data.part[taskMessage.info.id] ?? [];
        for (let pi = taskParts.length - 1; pi >= 0; pi -= 1) {
          const status = computeStatusFromPart(taskParts[pi] as unknown as CorePart);
          if (status) return status;
        }
      }
    }

    const msgs = assistantMessages();
    const parts = partStore();
    for (let mi = msgs.length - 1; mi >= 0; mi -= 1) {
      const msgParts = parts[msgs[mi].info.id] ?? [];
      for (let pi = msgParts.length - 1; pi >= 0; pi -= 1) {
        const status = computeStatusFromPart(msgParts[pi] as unknown as CorePart);
        if (status) return status;
      }
    }
    return "Considering next steps";
  });

  const durationRange = createMemo(() => {
    const user = userMessage();
    const lastAssistant = assistantMessages().at(-1);
    const from = readTime(user?.createdAt, "startedAt") ?? user?.createdAt;
    const to = readTime(lastAssistant?.updatedAt, "finishedAt") ?? lastAssistant?.updatedAt;
    return { from, to };
  });

  createEffect(() => {
    const update = () => {
      const range = durationRange();
      const to = working() ? Date.now() : range.to;
      setDurationText(formatDuration({ from: range.from, to }));
    };
    update();
    if (!working()) return;
    const timer = setInterval(update, 1000);
    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    const r = retry();
    if (!r) {
      setRetrySeconds(0);
      return;
    }
    const updateSeconds = () => {
      setRetrySeconds(Math.max(0, Math.round((r.next - Date.now()) / 1000)));
    };
    updateSeconds();
    const timer = setInterval(updateSeconds, 1000);
    onCleanup(() => clearInterval(timer));
  });

  createEffect(() => {
    const nextStatus = rawStatus();
    if (!nextStatus || nextStatus === statusText()) return;
    const elapsed = Date.now() - lastStatusAt;
    if (elapsed >= 2500) {
      setStatusText(nextStatus);
      lastStatusAt = Date.now();
      if (statusTimer) {
        clearTimeout(statusTimer);
        statusTimer = undefined;
      }
      return;
    }
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      setStatusText(rawStatus());
      lastStatusAt = Date.now();
      statusTimer = undefined;
    }, 2500 - elapsed);
  });

  onCleanup(() => {
    if (statusTimer) clearTimeout(statusTimer);
  });

  const handleCopy = async () => {
    const text = responseText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Show when={userMessage()}>
      {user => (
        <div class={cn("mb-6", props.class)}>
          <MessageBubble message={user()} />

          <Show when={showTrigger()}>
            <div class="mt-2 flex justify-start">
              <button
                class={cn(
                  "bg-card/30 border-border/30 hover:bg-card/50 rounded-lg border px-3 py-1.5 text-xs",
                  "text-muted-foreground inline-flex items-center gap-2 transition-colors"
                )}
                onClick={props.onToggleExpanded}
                aria-expanded={props.expanded}
              >
                <Switch>
                  <Match when={working()}>
                    <span class="bg-primary/70 inline-block h-2 w-2 animate-pulse rounded-full" />
                  </Match>
                  <Match when={!props.expanded}>
                    <span>▽</span>
                  </Match>
                  <Match when={props.expanded}>
                    <span>△</span>
                  </Match>
                </Switch>

                <Switch>
                  <Match when={retry()}>
                    {r => (
                      <span>
                        {truncate(unwrapError(r().message))}
                        {" · retrying"}
                        <Show when={retrySeconds() > 0}> in {retrySeconds()}s</Show> (#{r().attempt}
                        )
                      </span>
                    )}
                  </Match>
                  <Match when={working()}>
                    <span>{statusText()}</span>
                  </Match>
                  <Match when={props.expanded}>
                    <span>Hide steps</span>
                  </Match>
                  <Match when={!props.expanded}>
                    <span>Show steps</span>
                  </Match>
                </Switch>

                <span aria-hidden="true">·</span>
                <span aria-live="off">{durationText()}</span>
              </button>
            </div>
          </Show>

          <Show when={props.expanded && assistantMessages().length > 0}>
            <div class="mt-3 space-y-3" aria-hidden={working()}>
              <For each={assistantMessages()}>
                {assistant => (
                  <AssistantMessage
                    messageID={assistant.info.id}
                    sessionID={props.sessionID}
                    fallbackParts={assistant.parts}
                    hideSummary
                    hideReasoning={!working()}
                    hideFinalTextPart={
                      hideResponsePart() && !working() && assistant.info.id === lastAssistantID()
                    }
                    hidden={hidden()}
                  />
                )}
              </For>
            </div>
          </Show>

          <div class="sr-only" aria-live="polite">
            {!working() && responseText() ? responseText() : ""}
          </div>
          <Show when={!working() && responseText()}>
            <div class="border-border/30 bg-card/30 mt-3 rounded-xl border px-4 py-3">
              <div class="mb-2 flex items-center justify-between">
                <div class="text-muted-foreground text-xs font-medium">Response</div>
                <button
                  onMouseDown={event => event.preventDefault()}
                  onClick={event => {
                    event.stopPropagation();
                    void handleCopy();
                  }}
                  class="bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded px-2 py-1 text-xs"
                  aria-label={copied() ? "Copied" : "Copy"}
                >
                  {copied() ? "Copied" : "Copy"}
                </button>
              </div>
              <Markdown text={responseText()} class="prose-p:m-0" />
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
};

export default SessionTurn;
