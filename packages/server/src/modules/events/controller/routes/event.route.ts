import { createLogger } from "@sakti-code/shared/logger";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { v7 as uuidv7 } from "uuid";
import { ServerInstanceDisposed, subscribeAll } from "../../../../bus/index.js";

type Env = {
  Variables: {
    requestId: string;
    startTime: number;
  };
};

const app = new Hono<Env>();
const logger = createLogger("server");

app.get("/event", async c => {
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");
  c.header("Content-Encoding", "none");

  const requestId = c.get("requestId");
  logger.info("event SSE client connected", {
    module: "event",
    requestId,
  });

  return streamSSE(c, async stream => {
    const connectedEvent = {
      type: "server.connected",
      properties: {},
      eventId: uuidv7(),
      sequence: 0,
      timestamp: Date.now(),
    };
    await stream.writeSSE({
      id: connectedEvent.eventId,
      data: JSON.stringify(connectedEvent),
    });

    const unsub = subscribeAll(async event => {
      await stream.writeSSE({
        id: event.eventId,
        data: JSON.stringify(event),
      });

      if (event.type === ServerInstanceDisposed.type) {
        stream.close();
      }
    });

    const heartbeat = setInterval(() => {
      const heartbeatEvent = heartbeatEventFactory();
      stream
        .writeSSE({
          id: heartbeatEvent.eventId,
          data: JSON.stringify(heartbeatEvent),
        })
        .catch(err => {
          logger.error("Failed to send heartbeat", err, {
            module: "event",
            requestId,
          });
        });
    }, 30000);

    await new Promise<void>(resolve => {
      stream.onAbort(() => {
        clearInterval(heartbeat);
        unsub();
        logger.info("event SSE client disconnected", {
          module: "event",
          requestId,
        });
        resolve();
      });
    });
  });
});

function heartbeatEventFactory() {
  return {
    type: "server.heartbeat",
    properties: {},
    eventId: uuidv7(),
    sequence: 0,
    timestamp: Date.now(),
  };
}

export const eventRoutes = app;
