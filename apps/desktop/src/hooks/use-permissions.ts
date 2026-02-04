/**
 * usePermissions Hook
 *
 * SSE-based permission handling for tool execution.
 * Connects to the server's /api/events endpoint and handles permission:request events.
 *
 * Features:
 * - SSE connection with auto-reconnect
 * - Session-filtered permission requests
 * - Approve/deny methods with API calls
 * - Connection status tracking
 * - Comprehensive logging
 */
import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import type { EkacodeApiClient } from "../lib/api-client";
import { createLogger } from "../lib/logger";
import type { PermissionRequestData } from "../types/ui-message";

const logger = createLogger("desktop:permissions");

/**
 * Options for usePermissions hook
 */
export interface UsePermissionsOptions {
  /** API client instance */
  client: EkacodeApiClient;

  /** Workspace directory (reactive accessor) */
  workspace: Accessor<string>;

  /** Session ID for filtering requests (reactive accessor) */
  sessionId: Accessor<string | null>;

  /** Called when a new permission request arrives */
  onRequest?: (request: PermissionRequestData) => void;
}

/**
 * Result returned by usePermissions hook
 */
export interface UsePermissionsResult {
  /** All pending permission requests */
  pending: Accessor<PermissionRequestData[]>;

  /** Current (first) permission request to display */
  currentRequest: Accessor<PermissionRequestData | null>;

  /** Approve a permission request */
  approve: (id: string, patterns?: string[]) => Promise<void>;

  /** Deny a permission request */
  deny: (id: string) => Promise<void>;

  /** Whether SSE connection is active */
  isConnected: Accessor<boolean>;
}

/**
 * Hook for handling permission requests via SSE
 *
 * @example
 * ```tsx
 * function Workspace() {
 *   const [sessionId, setSessionId] = createSignal<string | null>(null);
 *
 *   const permissions = usePermissions({
 *     client,
 *     workspace: () => "/path/to/project",
 *     sessionId,
 *   });
 *
 *   return (
 *     <Show when={permissions.currentRequest()}>
 *       {(request) => (
 *         <PermissionDialog
 *           request={request()}
 *           onApprove={(id) => permissions.approve(id)}
 *           onDeny={(id) => permissions.deny(id)}
 *         />
 *       )}
 *     </Show>
 *   );
 * }
 * ```
 */
export function usePermissions(options: UsePermissionsOptions): UsePermissionsResult {
  const { client, workspace, sessionId, onRequest } = options;

  logger.debug("usePermissions hook initialized");

  const [pending, setPending] = createSignal<PermissionRequestData[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);

  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;

  /**
   * Connect to SSE endpoint
   */
  const connect = () => {
    const ws = workspace();
    if (!ws) {
      logger.debug("Cannot connect - no workspace");
      return;
    }

    // Clean up existing connection
    disconnect();

    logger.info("Connecting to permission events", {
      workspace: ws,
      sessionId: sessionId() ?? undefined,
    });

    try {
      eventSource = client.connectToEvents(ws, sessionId() ?? undefined);

      eventSource.onopen = () => {
        logger.info("Permission events connected", { workspace: ws });
        setIsConnected(true);
        reconnectAttempts = 0;
      };

      // Handle permission request events
      eventSource.addEventListener("permission:request", event => {
        try {
          const request = JSON.parse(event.data) as PermissionRequestData;

          // Filter by session if we have one
          const sid = sessionId();
          if (!sid || request.sessionID === sid) {
            logger.info("Permission request received", {
              id: request.id,
              toolName: request.toolName,
              sessionId: request.sessionID,
            });
            setPending(prev => [...prev, request]);
            onRequest?.(request);
          }
        } catch (e) {
          logger.error("Failed to parse permission request", e as Error);
        }
      });

      // Handle permission update events (resolved elsewhere)
      eventSource.addEventListener("permission:update", event => {
        try {
          const data = JSON.parse(event.data) as { id: string; resolved: boolean };
          if (data.resolved) {
            logger.debug("Permission resolved via update", { id: data.id });
            setPending(prev => prev.filter(p => p.id !== data.id));
          }
        } catch (e) {
          logger.error("Failed to parse permission update", e as Error);
        }
      });

      eventSource.onerror = () => {
        logger.warn("Permission events connection error");
        setIsConnected(false);

        // Auto-reconnect after delay
        if (!reconnectTimer) {
          reconnectAttempts++;
          logger.debug("Scheduling reconnect", { attempt: reconnectAttempts });
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 3000);
        }
      };
    } catch (e) {
      logger.error("Failed to connect to permission events", e as Error);
      setIsConnected(false);
    }
  };

  /**
   * Disconnect from SSE
   */
  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      logger.debug("Disconnecting permission events");
      eventSource.close();
      eventSource = null;
    }
    setIsConnected(false);
  };

  // Connect when workspace changes
  createEffect(() => {
    const ws = workspace();
    if (ws) {
      logger.debug("Workspace changed, reconnecting", { workspace: ws });
      connect();
    } else {
      logger.debug("Workspace cleared, disconnecting");
      disconnect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    logger.debug("usePermissions cleanup");
    disconnect();
  });

  /**
   * Approve a permission request
   */
  const approve = async (id: string, patterns?: string[]): Promise<void> => {
    logger.info("Approving permission", { id, patterns });
    try {
      await client.approvePermission(id, true, patterns);
      // Remove from pending immediately (optimistic)
      setPending(prev => prev.filter(p => p.id !== id));
      logger.info("Permission approved", { id });
    } catch (e) {
      logger.error("Failed to approve permission", e as Error, { id });
      throw e;
    }
  };

  /**
   * Deny a permission request
   */
  const deny = async (id: string): Promise<void> => {
    logger.info("Denying permission", { id });
    try {
      await client.approvePermission(id, false);
      // Remove from pending immediately (optimistic)
      setPending(prev => prev.filter(p => p.id !== id));
      logger.info("Permission denied", { id });
    } catch (e) {
      logger.error("Failed to deny permission", e as Error, { id });
      throw e;
    }
  };

  /**
   * Get current (first) request
   */
  const currentRequest = () => pending()[0] ?? null;

  return {
    pending,
    currentRequest,
    approve,
    deny,
    isConnected,
  };
}
