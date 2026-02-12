/**
 * useStreamDebugger Hook
 *
 * Captures and logs all stream events for debugging purposes.
 * Maintains an accumulating event log with full store snapshots.
 *
 * Features:
 * - Event accumulation across messages
 * - Full store state snapshots at each event
 * - Raw stream line capture
 * - Performance metrics (tokens/sec, duration)
 * - Manual clear/reset
 */
import { createSignal, type Accessor } from "solid-js";
import { unwrap } from "solid-js/store";
import type { ChatState } from "../types/ui-message";

export type StreamEventType =
  | "text-delta"
  | "tool-call-start"
  | "tool-call-delta"
  | "tool-call-end"
  | "tool-result"
  | "data-part"
  | "error"
  | "complete"
  | "message-start"
  | "raw";

export interface StreamEvent {
  /** Unique event ID */
  id: string;
  /** Timestamp when event was captured */
  timestamp: number;
  /** Event type */
  type: StreamEventType;
  /** Associated message ID (if any) */
  messageId?: string;
  /** Event payload/data */
  payload: unknown;
  /** Full store snapshot at time of event */
  storeSnapshot: ChatState;
  /** Raw SSE line (if captured) */
  rawLine?: string;
}

export interface StreamMetrics {
  /** Total stream duration in ms */
  duration: number;
  /** Total text tokens received */
  totalTokens: number;
  /** Average tokens per second */
  tokensPerSecond: number;
  /** Total number of events */
  eventCount: number;
  /** Stream start time */
  startTime: number | null;
  /** Stream end time */
  endTime: number | null;
}

export interface StreamDebuggerState {
  /** All captured events */
  events: StreamEvent[];
  /** Raw stream lines */
  rawLines: string[];
  /** Whether currently capturing */
  isCapturing: boolean;
  /** Performance metrics */
  metrics: StreamMetrics;
}

export interface UseStreamDebuggerResult {
  /** Current debugger state */
  state: Accessor<StreamDebuggerState>;
  /** All captured events */
  events: Accessor<StreamEvent[]>;
  /** Raw stream lines */
  rawLines: Accessor<string[]>;
  /** Performance metrics */
  metrics: Accessor<StreamMetrics>;
  /** Whether currently capturing */
  isCapturing: Accessor<boolean>;
  /** Log a new event */
  logEvent: (event: Omit<StreamEvent, "id" | "timestamp">) => void;
  /** Log a raw stream line */
  logRawLine: (line: string, storeSnapshot: ChatState) => void;
  /** Start a new capture session */
  startCapture: () => void;
  /** End the current capture session */
  endCapture: () => void;
  /** Clear all events and reset state */
  clear: () => void;
}

let eventCounter = 0;

/**
 * Create a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseRawLine(line: string): {
  type: StreamEventType;
  messageId?: string;
  payload: unknown;
} | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const payloadText = trimmed.slice(5).trim();
  if (!payloadText) return null;
  if (payloadText === "[DONE]") {
    return {
      type: "complete",
      payload: { done: true },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadText);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const chunk = parsed as Record<string, unknown>;
  const rawType = typeof chunk.type === "string" ? chunk.type : "";
  const id = typeof chunk.id === "string" ? chunk.id : undefined;

  if (rawType === "text-delta") {
    return {
      type: "text-delta",
      messageId: id,
      payload: {
        id,
        delta: typeof chunk.delta === "string" ? chunk.delta : "",
      },
    };
  }

  if (rawType === "finish") {
    return {
      type: "complete",
      messageId: id,
      payload: {
        id,
        finishReason: chunk.finishReason,
      },
    };
  }

  if (rawType === "error") {
    return {
      type: "error",
      messageId: id,
      payload: {
        id,
        errorText: chunk.errorText,
      },
    };
  }

  if (rawType === "data-tool-call") {
    return {
      type: "tool-call-start",
      messageId: undefined,
      payload: chunk,
    };
  }

  if (rawType === "data-tool-result") {
    return {
      type: "tool-result",
      messageId: undefined,
      payload: chunk,
    };
  }

  if (rawType.startsWith("data-")) {
    return {
      type: "data-part",
      messageId: id,
      payload: chunk,
    };
  }

  return {
    type: "raw",
    messageId: id,
    payload: chunk,
  };
}

/**
 * Hook for debugging stream processing
 *
 * @example
 * ```ts
 * const debugger = useStreamDebugger();
 *
 * // In stream parser callback
 * debugger.logEvent({
 *   type: 'text-delta',
 *   messageId: 'msg_123',
 *   payload: { delta: 'Hello' },
 *   storeSnapshot: chatStore.get()
 * });
 * ```
 */
export function useStreamDebugger(): UseStreamDebuggerResult {
  const [state, setState] = createSignal<StreamDebuggerState>({
    events: [],
    rawLines: [],
    isCapturing: false,
    metrics: {
      duration: 0,
      totalTokens: 0,
      tokensPerSecond: 0,
      eventCount: 0,
      startTime: null,
      endTime: null,
    },
  });

  /**
   * Log a new stream event
   */
  const logEvent = (event: Omit<StreamEvent, "id" | "timestamp">) => {
    // Unwrap the store snapshot to remove Solid proxies
    const unwrappedSnapshot = unwrap(event.storeSnapshot) as ChatState;

    const newEvent: StreamEvent = {
      ...event,
      storeSnapshot: unwrappedSnapshot,
      id: generateEventId(),
      timestamp: Date.now(),
    };

    setState(prev => {
      const events = [...prev.events, newEvent];
      const isTextDelta = event.type === "text-delta";
      const tokenCount = isTextDelta
        ? prev.metrics.totalTokens +
          String((event.payload as { delta?: string })?.delta || "").length
        : prev.metrics.totalTokens;

      const duration = prev.metrics.startTime ? Date.now() - prev.metrics.startTime : 0;

      return {
        ...prev,
        events,
        metrics: {
          ...prev.metrics,
          totalTokens: tokenCount,
          eventCount: events.length,
          duration,
          tokensPerSecond: duration > 0 ? (tokenCount / duration) * 1000 : 0,
        },
      };
    });
  };

  /**
   * Log a raw stream line
   */
  const logRawLine = (line: string, storeSnapshot: ChatState) => {
    setState(prev => ({
      ...prev,
      rawLines: [...prev.rawLines, line],
    }));

    const parsed = parseRawLine(line);
    if (parsed) {
      logEvent({
        type: parsed.type,
        messageId: parsed.messageId,
        payload: parsed.payload,
        storeSnapshot,
        rawLine: line,
      });
      return;
    }

    logEvent({
      type: "raw",
      payload: { line },
      storeSnapshot,
      rawLine: line,
    });
  };

  /**
   * Start a new capture session
   */
  const startCapture = () => {
    setState(prev => ({
      ...prev,
      isCapturing: true,
      metrics: {
        ...prev.metrics,
        startTime: Date.now(),
        endTime: null,
      },
    }));
  };

  /**
   * End the current capture session
   */
  const endCapture = () => {
    setState(prev => {
      const endTime = Date.now();
      const duration = prev.metrics.startTime
        ? endTime - prev.metrics.startTime
        : prev.metrics.duration;

      return {
        ...prev,
        isCapturing: false,
        metrics: {
          ...prev.metrics,
          endTime,
          duration,
          tokensPerSecond: duration > 0 ? (prev.metrics.totalTokens / duration) * 1000 : 0,
        },
      };
    });
  };

  /**
   * Clear all events and reset state
   */
  const clear = () => {
    eventCounter = 0;
    setState({
      events: [],
      rawLines: [],
      isCapturing: false,
      metrics: {
        duration: 0,
        totalTokens: 0,
        tokensPerSecond: 0,
        eventCount: 0,
        startTime: null,
        endTime: null,
      },
    });
  };

  return {
    state,
    events: () => state().events,
    rawLines: () => state().rawLines,
    metrics: () => state().metrics,
    isCapturing: () => state().isCapturing,
    logEvent,
    logRawLine,
    startCapture,
    endCapture,
    clear,
  };
}

export default useStreamDebugger;
