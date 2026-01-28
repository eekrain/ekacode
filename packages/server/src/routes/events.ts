/**
 * Events API - Server-Sent Events for real-time updates
 * Based on OpenCode's event streaming pattern
 */

import { PermissionManager } from "@ekacode/core";
import type { PermissionRequest } from "@ekacode/shared";
import { createLogger } from "@ekacode/shared/logger";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

type Env = {
  Variables: {
    requestId: string;
    startTime: number;
  };
};

const app = new Hono<Env>();
const logger = createLogger("server");

/**
 * SSE endpoint for real-time permission request streaming
 * Clients can connect and receive permission requests as they happen
 *
 * Usage:
 * const eventSource = new EventSource('http://localhost:PORT/api/events');
 * eventSource.addEventListener('permission:request', (e) => {
 *   const request = JSON.parse(e.data);
 *   // Show permission dialog to user
 * });
 */
app.get("/api/events", async c => {
  const requestId = c.get("requestId");
  const permissionMgr = PermissionManager.getInstance();

  logger.info("SSE client connected", {
    module: "events",
    requestId,
  });

  return streamSSE(c, async stream => {
    // Send connection confirmation
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({
        timestamp: Date.now(),
        message: "Connected to ekacode events",
      }),
    });

    // Set up event handlers
    const permissionHandler = (request: PermissionRequest) => {
      stream
        .writeSSE({
          event: "permission:request",
          data: JSON.stringify(request),
        })
        .catch((err: Error) => {
          logger.error("Failed to send permission event", err, {
            module: "events",
            requestId,
          });
        });
    };

    // Subscribe to permission request events
    permissionMgr.on("permission:request", permissionHandler);

    // Send heartbeat every 30 seconds to prevent timeout
    const heartbeat = setInterval(() => {
      stream
        .writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: Date.now() }),
        })
        .catch((err: Error) => {
          logger.error("Failed to send heartbeat", err, {
            module: "events",
            requestId,
          });
          clearInterval(heartbeat);
        });
    }, 30000);

    // Clean up on disconnect
    stream.onAbort(() => {
      clearInterval(heartbeat);
      permissionMgr.off("permission:request", permissionHandler);
      logger.info("SSE client disconnected", {
        module: "events",
        requestId,
      });
    });

    // Keep connection alive
    await new Promise<void>(resolve => {
      stream.onAbort(() => resolve());
    });
  });
});

/**
 * Alternative WebSocket-style endpoint for permission updates
 * Similar to OpenCode's /event endpoint
 *
 * This provides the same functionality as SSE but can be useful
 * for clients that prefer WebSocket connections
 */
app.get("/api/events/permissions", c => {
  const requestId = c.get("requestId");
  const permissionMgr = PermissionManager.getInstance();

  logger.info("Permission events client connected", {
    module: "events",
    requestId,
  });

  return streamSSE(c, async stream => {
    // Send initial state
    const pending = permissionMgr.getPendingRequests();
    await stream.writeSSE({
      event: "init",
      data: JSON.stringify({
        timestamp: Date.now(),
        pending,
      }),
    });

    // Subscribe to permission request events
    const permissionHandler = (request: PermissionRequest) => {
      stream.writeSSE({
        event: "permission:request",
        data: JSON.stringify(request),
      });
    };

    permissionMgr.on("permission:request", permissionHandler);

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ timestamp: Date.now() }),
      });
    }, 30000);

    // Clean up on disconnect
    stream.onAbort(() => {
      clearInterval(heartbeat);
      permissionMgr.off("permission:request", permissionHandler);
      logger.info("Permission events client disconnected", {
        module: "events",
        requestId,
      });
    });

    await new Promise<void>(resolve => {
      stream.onAbort(() => resolve());
    });
  });
});

export default app;
