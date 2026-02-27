import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { Env } from "../../../../index.js";
import { zValidator } from "../../../../shared/controller/http/validators.js";
import { buildTaskRunUsecases } from "../factory/task-runs.factory.js";
import { TaskRunParamsSchema } from "../schemas/task-run.schema.js";

const app = new Hono<Env>();
const { getTaskRunByIdUsecase, listRunEventsUsecase } = buildTaskRunUsecases();

const querySchema = z.object({
  afterEventSeq: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

const sseQuerySchema = z.object({
  afterEventSeq: z.coerce.number().int().min(0).optional(),
});

app.get(
  "/api/runs/:runId/events",
  zValidator("param", TaskRunParamsSchema),
  zValidator("query", querySchema),
  async c => {
    const { runId } = c.req.valid("param");
    const parsed = c.req.valid("query");

    try {
      const { run, events } = await listRunEventsUsecase({
        runId,
        afterEventSeq: parsed.afterEventSeq,
        limit: parsed.limit,
      });

      const lastEventSeq =
        events.length > 0 ? events[events.length - 1].eventSeq : parsed.afterEventSeq;

      return c.json({
        runId,
        taskSessionId: run.taskSessionId,
        events,
        lastEventSeq,
        hasMore: events.length >= parsed.limit,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Run not found") {
        return c.json({ error: "Run not found" }, 404);
      }
      throw error;
    }
  }
);

app.get(
  "/api/runs/:runId/events:sse",
  zValidator("param", TaskRunParamsSchema),
  zValidator("query", sseQuerySchema),
  async c => {
    const { runId } = c.req.valid("param");
    const run = await getTaskRunByIdUsecase(runId);
    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }

    const explicitAfter = c.req.valid("query").afterEventSeq;
    const lastEventId = c.req.header("Last-Event-ID");
    const afterEventSeq =
      explicitAfter !== undefined ? Number(explicitAfter) : Number(lastEventId ?? "0");
    const safeAfter = Number.isFinite(afterEventSeq) && afterEventSeq >= 0 ? afterEventSeq : 0;

    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    c.header("X-Accel-Buffering", "no");
    c.header("Content-Encoding", "none");

    return streamSSE(c, async stream => {
      let aborted = false;
      stream.onAbort(() => {
        aborted = true;
      });

      let cursor = safeAfter;
      const writeEventsAfterCursor = async (): Promise<number> => {
        const { events: backlog } = await listRunEventsUsecase({
          runId,
          afterEventSeq: cursor,
          limit: 1000,
        });
        for (const event of backlog) {
          await stream.writeSSE({
            id: String(event.eventSeq),
            data: JSON.stringify(event),
          });
          cursor = event.eventSeq;
        }
        return backlog.length;
      };

      await writeEventsAfterCursor();

      const terminalStates = new Set(["completed", "failed", "canceled", "dead"]);
      while (!aborted) {
        const latestRun = await getTaskRunByIdUsecase(runId);
        const appended = await writeEventsAfterCursor();
        if (!latestRun || (terminalStates.has(latestRun.state) && appended === 0)) {
          break;
        }
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), 250);
        });
      }

      stream.close();
    });
  }
);

export const runEventsRoutes = app;
