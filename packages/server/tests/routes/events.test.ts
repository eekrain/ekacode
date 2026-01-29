/**
 * SSE events route tests
 */

import { PermissionManager } from "@ekacode/core/server";
import { TextDecoder } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const decoder = new TextDecoder();

async function readChunk(reader: {
  read: () => Promise<{ value?: Uint8Array }>;
  cancel: () => Promise<void>;
}): Promise<string> {
  const { value } = await reader.read();
  return value ? decoder.decode(value) : "";
}

async function readWithTimeout(
  reader: {
    read: () => Promise<{ value?: Uint8Array }>;
    cancel: () => Promise<void>;
  },
  timeoutMs: number
): Promise<string | null> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">(resolve => {
    timeoutId = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const result = await Promise.race([
    reader.read().then(r => ({ kind: "read" as const, value: r.value })),
    timeout,
  ]);

  if (result === "timeout") {
    if (timeoutId) clearTimeout(timeoutId);
    await reader.cancel();
    return null;
  }

  if (timeoutId) clearTimeout(timeoutId);
  return result.value ? decoder.decode(result.value) : "";
}

describe("events SSE stream", () => {
  beforeEach(async () => {
    const { setupTestDatabase } = await import("../../db/test-setup");
    await setupTestDatabase();
    const { db, sessions } = await import("../../db");
    await db.delete(sessions);
  });

  afterEach(async () => {
    const { db, sessions } = await import("../../db");
    await db.delete(sessions);
  });

  it("includes session and directory in connected event", async () => {
    const eventsRouter = (await import("../../src/routes/events")).default;
    const { createSession } = await import("../../db/sessions");
    const session = await createSession("local");

    const response = await eventsRouter.request(
      `http://localhost/api/events?directory=/tmp/events`,
      {
        headers: {
          "X-Session-ID": session.sessionId,
        },
      }
    );

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response body reader");

    const firstChunk = await readChunk(reader);
    await reader.cancel();

    expect(firstChunk).toContain("event: connected");
    expect(firstChunk).toContain(`\"sessionId\":\"${session.sessionId}\"`);
    expect(firstChunk).toContain(`\"directory\":\"/tmp/events\"`);
  });

  it("filters permission events by sessionId", async () => {
    const eventsRouter = (await import("../../src/routes/events")).default;
    const { createSession } = await import("../../db/sessions");
    const session = await createSession("local");

    const response = await eventsRouter.request("http://localhost/api/events", {
      headers: {
        "X-Session-ID": session.sessionId,
      },
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response body reader");

    // Consume connected event
    await readChunk(reader);

    const permissionMgr = PermissionManager.getInstance();
    permissionMgr.emit("permission:request", {
      id: "perm-1",
      permission: "read",
      patterns: ["/tmp/file.txt"],
      always: [],
      sessionID: "other-session",
    });

    const noEvent = await readWithTimeout(reader, 50);
    expect(noEvent).toBeNull();
  });

  it("streams permission events for matching session", async () => {
    const eventsRouter = (await import("../../src/routes/events")).default;
    const { createSession } = await import("../../db/sessions");
    const session = await createSession("local");

    const response = await eventsRouter.request("http://localhost/api/events", {
      headers: {
        "X-Session-ID": session.sessionId,
      },
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response body reader");

    // Consume connected event
    await readChunk(reader);

    const permissionMgr = PermissionManager.getInstance();
    permissionMgr.emit("permission:request", {
      id: "perm-2",
      permission: "read",
      patterns: ["/tmp/file.txt"],
      always: [],
      sessionID: session.sessionId,
    });

    const eventChunk = await readWithTimeout(reader, 100);
    await reader.cancel();

    expect(eventChunk).not.toBeNull();
    expect(eventChunk).toContain("permission:request");
    expect(eventChunk).toContain(`\"sessionID\":\"${session.sessionId}\"`);
  });
});
