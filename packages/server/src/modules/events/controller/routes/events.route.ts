import { createLogger } from "@sakti-code/shared/logger";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../../../../shared/controller/http/validators.js";
import { buildEventUsecases } from "../factory/events.factory.js";

type Env = {
  Variables: {
    requestId: string;
    startTime: number;
  };
};

const app = new Hono<Env>();
const logger = createLogger("server:events");
const { listEventsUsecase } = buildEventUsecases();

const eventsQuerySchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  afterSequence: z.coerce.number().optional(),
  afterEventId: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
});

app.get("/api/events", zValidator("query", eventsQuerySchema), async c => {
  const { sessionId, afterSequence, afterEventId, limit } = c.req.valid("query");

  logger.debug("Fetching events", { sessionId, afterSequence, afterEventId, limit });

  try {
    const response = await listEventsUsecase({
      sessionId,
      afterSequence,
      afterEventId,
      limit,
    });

    logger.debug("Events fetched", {
      sessionId,
      count: response.events.length,
      hasMore: response.hasMore,
      total: response.total,
    });

    return c.json(response);
  } catch (error) {
    logger.error("Failed to fetch events", error as Error, { sessionId });
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

app.get("/api/events/health", c => {
  return c.json({ status: "ok", service: "events" });
});

export const eventsRoutes = app;
