/**
 * UIMessage stream chat route tests
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("chat UIMessage stream", () => {
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

  it("streams UIMessage parts with correct headers", async () => {
    const chatRouter = (await import("../../src/routes/chat")).default;

    const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Hello", stream: true }),
    });

    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    expect(response.headers.get("content-type") || "").toContain("text/plain");

    const body = await response.text();
    expect(body).toContain("data-session");
    expect(body).toContain("Echo: You said");
    expect(body).toContain('"finishReason":"stop"');
  });
});
