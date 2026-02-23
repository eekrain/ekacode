/**
 * Tests for health endpoint
 *
 * TDD approach: Tests written first to define expected behavior
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Test files use any for simplicity */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("health endpoint", () => {
  let mockApp: Hono<any>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a test app
    mockApp = new Hono();

    // Import and use the health router
    const { default: healthRouter } = await import("../health");
    mockApp.route("/", healthRouter);
  });

  describe("GET /api/health", () => {
    it("should return 200 with status ok", async () => {
      const response = await mockApp.request("/api/health");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
    });

    it("should return uptime in seconds", async () => {
      const response = await mockApp.request("/api/health");
      const data = await response.json();

      expect(data.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof data.uptime).toBe("number");
    });

    it("should return ISO timestamp", async () => {
      const response = await mockApp.request("/api/health");
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      // Should be parseable as a date
      expect(() => new Date(data.timestamp)).not.toThrow();
      // Should be recent (within last minute)
      const timestamp = new Date(data.timestamp);
      const now = new Date();
      const diffMs = now.getTime() - timestamp.getTime();
      expect(diffMs).toBeLessThan(60000); // Less than 1 minute
    });

    it("should return version", async () => {
      const response = await mockApp.request("/api/health");
      const data = await response.json();

      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe("string");
    });

    it("should not require authentication", async () => {
      // Request without auth headers should succeed
      const response = await mockApp.request("/api/health");

      expect(response.status).toBe(200);
    });

    it("should have content-type application/json", async () => {
      const response = await mockApp.request("/api/health");

      expect(response.headers.get("content-type")).toMatch(/application\/json/);
    });
  });
});
