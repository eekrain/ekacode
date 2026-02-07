/**
 * Global SDK Provider - Opencode-style SSE with coalescing
 *
 * Provides:
 * - SSE connection to server's /event endpoint
 * - 16ms event coalescing to prevent excessive re-renders
 * - Directory-based event routing
 * - SDK client for API calls
 *
 * Based on opencode packages/app/src/context/global-sdk.tsx
 */

import { createGlobalEmitter } from "@solid-primitives/event-bus";
import { batch, createContext, JSX, onCleanup, useContext } from "solid-js";

/**
 * Server event format
 */
export interface ServerEvent {
  type: string;
  properties: Record<string, unknown>;
}

type IncomingEvent =
  | ServerEvent
  | {
      directory?: string;
      payload?: ServerEvent;
    };

/**
 * SDK client interface
 */
export interface SDKClient {
  baseUrl: string;
  session: {
    list(): Promise<SessionInfo[]>;
    get(sessionID: string): Promise<SessionInfo>;
    messages(options: {
      sessionID: string;
      limit?: number;
      offset?: number;
    }): Promise<SessionMessagesResponse>;
  };
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
}

export interface SessionInfo {
  sessionId: string;
  resourceId: string;
  threadId?: string;
  createdAt: string;
  lastAccessed: string;
}

export interface SessionMessagesResponse {
  sessionID: string;
  messages: unknown[];
  hasMore: boolean;
  total?: number;
}

/**
 * Queued event with directory routing
 */
type Queued = {
  directory: string;
  payload: ServerEvent;
};

/**
 * Global SDK context value
 */
export interface GlobalSDKContextValue {
  url: string;
  client: SDKClient;
  event: ReturnType<typeof createGlobalEmitter<Record<string, ServerEvent>>>;
}

/**
 * Create event client SDK interface
 */
function createSDKClient(baseUrl: string, token: string): SDKClient {
  const fetchFn = fetch;
  const url = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Basic ${btoa(`admin:${token}`)}`;
    }

    const response = await fetchFn(`${url}${path}`, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  return {
    baseUrl,
    session: {
      async list(): Promise<SessionInfo[]> {
        const result = await request<{ sessions: SessionInfo[] }>("/api/sessions");
        return result.sessions || [];
      },
      async get(sessionID: string): Promise<SessionInfo> {
        return request<SessionInfo>(`/api/sessions/${sessionID}`);
      },
      async messages(options: {
        sessionID: string;
        limit?: number;
        offset?: number;
      }): Promise<SessionMessagesResponse> {
        const params = new URLSearchParams();
        if (options.limit) params.set("limit", String(options.limit));
        if (options.offset) params.set("offset", String(options.offset));
        const queryString = params.toString() ? `?${params}` : "";
        return request<SessionMessagesResponse>(
          `/api/chat/${options.sessionID}/messages${queryString}`
        );
      },
    },
    fetch: async (path: string, init?: RequestInit) => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      // Copy existing headers
      if (init?.headers) {
        const existingHeaders = new Headers(init.headers);
        existingHeaders.forEach((value, key) => {
          (headers as Record<string, string>)[key] = value;
        });
      }
      if (token) {
        (headers as Record<string, string>)["Authorization"] = `Basic ${btoa(`admin:${token}`)}`;
      }
      return fetchFn(`${url}${path}`, { ...init, headers });
    },
  };
}

/**
 * Coalescing key function
 * Returns a key to deduplicate events by directory and content
 */
function coalesceKey(directory: string, payload: ServerEvent): string | undefined {
  if (payload.type === "session.status") {
    return `session.status:${directory}:${payload.properties.sessionID}`;
  }
  if (payload.type === "message.part.updated") {
    const part = payload.properties.part as { messageID?: string; id?: string } | undefined;
    return `message.part.updated:${directory}:${part?.messageID || ""}:${part?.id || ""}`;
  }
  return undefined;
}

/**
 * Global SDK Context
 */
const GlobalSDKContext = createContext<GlobalSDKContextValue | undefined>(undefined);

/**
 * Global SDK Provider component
 */
export function GlobalSDKProvider(props: {
  baseUrl: string;
  token: string;
  children: JSX.Element;
}) {
  const { baseUrl, token } = props;
  const emitter = createGlobalEmitter<Record<string, ServerEvent>>();

  // Coalescing state
  let queue: Array<Queued | undefined> = [];
  let buffer: Array<Queued | undefined> = [];
  const coalesced = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = 0;

  /**
   * Flush queued events in a batch
   */
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;

    if (queue.length === 0) return;

    const events = queue;
    queue = buffer;
    buffer = events;
    queue.length = 0;
    coalesced.clear();

    last = Date.now();
    batch(() => {
      for (const event of events) {
        if (!event) continue;
        emitter.emit(event.directory, event.payload);
      }
    });

    buffer.length = 0;
  };

  /**
   * Schedule a flush (16ms target for ~60fps)
   */
  const schedule = () => {
    if (timer) return;
    const elapsed = Date.now() - last;
    timer = setTimeout(flush, Math.max(0, 16 - elapsed));
  };

  const eventUrl = new URL(`${baseUrl}/event`);
  if (token) {
    eventUrl.searchParams.set("token", token);
  }

  const eventSource = new EventSource(eventUrl.toString());

  eventSource.addEventListener("message", (evt: MessageEvent) => {
    try {
      const parsed = JSON.parse(evt.data) as IncomingEvent;

      const payload =
        parsed && typeof parsed === "object" && "payload" in parsed && parsed.payload
          ? parsed.payload
          : (parsed as ServerEvent);
      const parsedDirectory =
        parsed && typeof parsed === "object" && "directory" in parsed
          ? parsed.directory
          : undefined;
      const propertiesDirectory =
        payload.properties && typeof payload.properties.directory === "string"
          ? payload.properties.directory
          : undefined;
      const directory = parsedDirectory || propertiesDirectory || "global";
      const event = { directory, payload };

      const key = coalesceKey(directory, payload);
      if (key) {
        const i = coalesced.get(key);
        if (i !== undefined) {
          queue[i] = undefined;
        }
        coalesced.set(key, queue.length);
      }

      queue.push(event);
      schedule();
    } catch (error) {
      console.error("Failed to parse SSE event:", error);
    }
  });

  eventSource.onerror = error => {
    console.error("EventSource error:", error);
  };

  onCleanup(() => {
    eventSource.close();
    flush();
  });

  // Create SDK client
  const client = createSDKClient(baseUrl, token);

  const value: GlobalSDKContextValue = {
    url: baseUrl,
    client,
    event: emitter,
  };

  return <GlobalSDKContext.Provider value={value}>{props.children}</GlobalSDKContext.Provider>;
}

/**
 * Hook to access global SDK context
 */
export function useGlobalSDK(): GlobalSDKContextValue {
  const context = useContext(GlobalSDKContext);
  if (!context) throw new Error("useGlobalSDK must be used within GlobalSDKProvider");
  return context;
}
