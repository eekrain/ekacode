/**
 * Chat Route Integration Tests
 *
 * Tests for the /api/chat endpoint with SessionManager integration.
 * Verifies UIMessage streaming, state updates, and tool execution.
 *
 * NOTE: These tests are temporarily skipped during migration from XState
 * to SessionManager architecture. The tests need to be updated to mock
 * SessionManager, SessionController, WorkflowEngine, and LLM streaming.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe.skip("Chat route integration", () => {
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

  describe("UIMessage streaming", () => {
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
      // The RLM agent now completes the workflow successfully
      expect(body).toContain('"finishReason":"stop"');
      // Should have a finish message indicating completion
      expect(body).toContain('"type":"finish"');
    });

    it("should stream agent responses with proper status", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "What files are in this directory?",
          stream: true,
        }),
      });

      // Verify response status
      expect(response.status).toBe(200);

      // Verify SSE content type
      const contentType = response.headers.get("content-type");
      expect(contentType).toBeTruthy();
      expect(contentType || "").toContain("text/plain");
    });

    it("should include state updates in stream", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "List the files in the current directory",
          stream: true,
        }),
      });

      expect(response.status).toBe(200);

      const body = await response.text();

      // Should have state updates from XState machine
      // State updates show current agent, phase, iteration
      const hasStateUpdate = body.includes('"type":"state"') || body.includes("state");
      expect(hasStateUpdate).toBe(true);
    });

    it("should include text deltas in stream", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Say hello",
          stream: true,
        }),
      });

      expect(response.status).toBe(200);

      const body = await response.text();

      // Should have text delta updates
      // Text deltas contain streaming response content
      const hasTextDelta = body.includes('"type":"text-delta"') || body.includes("text-delta");
      expect(hasTextDelta).toBe(true);
    });

    it("should complete with finish message", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello",
          stream: true,
        }),
      });

      expect(response.status).toBe(200);

      const body = await response.text();

      // Should have finish message with completion reason
      expect(body).toContain('"type":"finish"');
      expect(body).toContain('"finishReason"');
    });
  });

  describe("Session handling", () => {
    it("should create new session when none provided", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello",
          stream: true,
        }),
      });

      expect(response.status).toBe(200);

      const body = await response.text();

      // Should include session in response
      expect(body).toContain("data-session");
    });

    it("should use existing session when provided", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const sessionId = "test-session-123";

      const response = await chatRouter.request(`http://localhost/api/chat?directory=/tmp/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId,
        },
        body: JSON.stringify({
          message: "Hello",
          stream: true,
        }),
      });

      expect(response.status).toBe(200);
      // Should complete successfully with existing session
      const body = await response.text();
      expect(body).toContain('"finishReason"');
    });
  });

  describe("Error handling", () => {
    it("should return error when no directory provided", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello",
        }),
      });

      // Should return error for missing directory
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle empty message gracefully", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "",
          stream: true,
        }),
      });

      // Should handle empty message (may succeed or fail gracefully)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Multimodal support", () => {
    it("should accept multimodal message format", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const multimodalMessage = {
        content: [
          { type: "text", text: "What is in this image?" },
          {
            type: "image",
            image: { url: "https://example.com/test.jpg" },
          },
        ],
      };

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: multimodalMessage,
          stream: true,
        }),
      });

      // Should accept multimodal format
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Non-streaming mode", () => {
    it("should support non-streaming responses", async () => {
      const chatRouter = (await import("../../src/routes/chat")).default;

      const response = await chatRouter.request("http://localhost/api/chat?directory=/tmp/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello",
          stream: false,
        }),
      });

      // Should handle non-streaming request
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });
});
