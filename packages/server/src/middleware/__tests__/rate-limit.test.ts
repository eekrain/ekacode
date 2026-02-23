/**
 * Tests for rate limit middleware
 *
 * TDD approach: Tests written first to define expected behavior
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Test files use any for simplicity */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../index";

describe("rate limit middleware", () => {
  let mockApp: Hono<any>;
  let resetRateLimit: (identifier?: string) => void;
  let getRateLimitStats: () => {
    totalClients: number;
    windowMs: number;
    maxRequests: number;
    clients: Array<{ identifier: string; recordCount: number; blocked: boolean }>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear module cache
    vi.resetModules();

    // Create a test app with request logging (sets requestId)
    mockApp = new Hono<Env>();

    mockApp.use("*", async (c, next) => {
      const { v7: uuidv7 } = await import("uuid");
      const requestId = uuidv7();
      c.set("requestId", requestId);
      await next();
    });

    // Import and use the rate limit middleware
    const rateLimitModule = await import("../rate-limit");
    mockApp.use("*", rateLimitModule.rateLimitMiddleware);

    resetRateLimit = rateLimitModule.resetRateLimit;
    getRateLimitStats = rateLimitModule.getRateLimitStats;

    // Add test endpoints
    mockApp.get("/api/data", c => {
      return c.json({ message: "success" });
    });

    mockApp.post("/api/data", c => {
      return c.json({ message: "created" });
    });

    mockApp.get("/api/skip", c => {
      return c.json({ message: "skipped" });
    });

    // Clear rate limits before each test
    resetRateLimit();
  });

  describe("basic rate limiting", () => {
    it("should allow requests under the limit", async () => {
      const response = await mockApp.request("/api/data");

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();

      const data = await response.json();
      expect(data.message).toBe("success");
    });

    it("should set rate limit headers", async () => {
      const response = await mockApp.request("/api/data");

      expect(response.headers.get("X-RateLimit-Limit")).toBe("100");
      expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
      expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
    });

    it("should decrement remaining count", async () => {
      const response1 = await mockApp.request("/api/data");
      const remaining1 = parseInt(response1.headers.get("X-RateLimit-Remaining") || "0", 10);

      const response2 = await mockApp.request("/api/data");
      const remaining2 = parseInt(response2.headers.get("X-RateLimit-Remaining") || "0", 10);

      // Remaining should decrease
      expect(remaining2).toBeLessThan(remaining1);
    });

    it("should return 429 when limit exceeded", async () => {
      // Create app with stricter limit for testing
      const strictApp = new Hono<Env>();

      const { createRateLimitMiddleware } = await import("../rate-limit");
      const strictMiddleware = createRateLimitMiddleware({ windowMs: 10000, maxRequests: 3 });

      strictApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      strictApp.use("*", strictMiddleware);

      strictApp.get("/api/test", c => c.json({ message: "ok" }));

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const response = await strictApp.request("/api/test");
        expect(response.status).toBe(200);
      }

      // 4th request should be rate limited
      const response4 = await strictApp.request("/api/test");
      expect(response4.status).toBe(429);
      const data = await response4.json();
      expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(data.error.message).toContain("Too many requests");
      expect(data.error.retryAfter).toBeDefined();

      strictMiddleware.reset();
    });

    it("should include retry-after header when rate limited", async () => {
      const strictApp = new Hono<Env>();

      const { createRateLimitMiddleware } = await import("../rate-limit");
      const strictMiddleware = createRateLimitMiddleware({ windowMs: 10000, maxRequests: 2 });

      strictApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      strictApp.use("*", strictMiddleware);

      strictApp.get("/api/test", c => c.json({ message: "ok" }));

      // Exhaust limit
      await strictApp.request("/api/test");
      await strictApp.request("/api/test");

      // Should be rate limited
      const response = await strictApp.request("/api/test");
      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.error.retryAfter).toBeGreaterThan(0);
      expect(data.error.retryAfter).toBeLessThanOrEqual(10);

      strictMiddleware.reset();
    });
  });

  describe("rate limit statistics", () => {
    it("should track number of clients", async () => {
      const stats1 = getRateLimitStats();
      expect(stats1.totalClients).toBe(0);

      await mockApp.request("/api/data");

      const stats2 = getRateLimitStats();
      expect(stats2.totalClients).toBeGreaterThan(0);
    });

    it("should show window and limit configuration", () => {
      const stats = getRateLimitStats();

      expect(stats.windowMs).toBe(60000);
      expect(stats.maxRequests).toBe(100);
    });

    it("should track client record counts", async () => {
      await mockApp.request("/api/data");
      await mockApp.request("/api/data");

      const stats = getRateLimitStats();
      const client = stats.clients[0];

      expect(client).toBeDefined();
      expect(client.recordCount).toBeGreaterThan(0);
    });
  });

  describe("reset functionality", () => {
    it("should reset all rate limits", async () => {
      // Make some requests
      await mockApp.request("/api/data");
      await mockApp.request("/api/data");

      expect(getRateLimitStats().totalClients).toBeGreaterThan(0);

      // Reset all
      resetRateLimit();

      expect(getRateLimitStats().totalClients).toBe(0);
    });

    it("should allow requests after reset", async () => {
      const strictApp = new Hono<Env>();

      const { createRateLimitMiddleware } = await import("../rate-limit");
      const strictMiddleware = createRateLimitMiddleware({ windowMs: 10000, maxRequests: 2 });

      strictApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      strictApp.use("*", strictMiddleware);

      strictApp.get("/api/test", c => c.json({ message: "ok" }));

      // Exhaust limit
      await strictApp.request("/api/test");
      await strictApp.request("/api/test");

      // Should be rate limited
      const response1 = await strictApp.request("/api/test");
      expect(response1.status).toBe(429);

      // Reset using attached method
      strictMiddleware.reset();

      // Should work again
      const response2 = await strictApp.request("/api/test");
      expect(response2.status).toBe(200);
    });
  });

  describe("custom rate limit options", () => {
    it("should support custom window duration", async () => {
      const customApp = new Hono<Env>();

      const { createRateLimitMiddleware, resetRateLimit: customReset } =
        await import("../rate-limit");
      customApp.use("*", createRateLimitMiddleware({ windowMs: 5000, maxRequests: 10 }));

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/test", c => c.json({ message: "ok" }));

      const response = await customApp.request("/api/test");

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");

      const stats = getRateLimitStats();
      expect(stats.windowMs).toBe(60000); // Global stats unchanged

      customReset();
    });

    it("should support custom max requests", async () => {
      const customApp = new Hono<Env>();

      const { createRateLimitMiddleware, resetRateLimit: customReset } =
        await import("../rate-limit");
      customApp.use("*", createRateLimitMiddleware({ windowMs: 60000, maxRequests: 5 }));

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/test", c => c.json({ message: "ok" }));

      const response = await customApp.request("/api/test");

      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("4");

      customReset();
    });

    it("should support path exclusion", async () => {
      const customApp = new Hono<Env>();

      const { createRateLimitMiddleware, resetRateLimit: customReset } =
        await import("../rate-limit");
      customApp.use("*", createRateLimitMiddleware({ excludePaths: ["/api/skip"] }));

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/limited", c => c.json({ message: "limited" }));
      customApp.get("/api/skip", c => c.json({ message: "skipped" }));

      // Limited endpoint should have rate limit headers
      const response1 = await customApp.request("/api/limited");
      expect(response1.headers.get("X-RateLimit-Limit")).toBe("100");

      // Skipped endpoint should not have rate limit headers
      const response2 = await customApp.request("/api/skip");
      expect(response2.headers.get("X-RateLimit-Limit")).toBeNull();

      customReset();
    });
  });

  describe("client identification", () => {
    it("should use X-Forwarded-For header when present", async () => {
      const response = await mockApp.request("/api/data", {
        headers: {
          "X-Forwarded-For": "192.168.1.100",
        },
      });

      expect(response.status).toBe(200);

      const stats = getRateLimitStats();
      expect(stats.clients.some(c => c.identifier.includes("192.168.1.100"))).toBe(true);
    });

    it("should use CF-Connecting-IP header when present", async () => {
      const response = await mockApp.request("/api/data", {
        headers: {
          "CF-Connecting-IP": "203.0.113.1",
        },
      });

      expect(response.status).toBe(200);

      const stats = getRateLimitStats();
      expect(stats.clients.some(c => c.identifier.includes("203.0.113.1"))).toBe(true);
    });

    it("should prefer X-Forwarded-For over CF-Connecting-IP", async () => {
      const response = await mockApp.request("/api/data", {
        headers: {
          "X-Forwarded-For": "10.0.0.1",
          "CF-Connecting-IP": "203.0.113.1",
        },
      });

      expect(response.status).toBe(200);

      const stats = getRateLimitStats();
      // Should use the first IP from X-Forwarded-For
      expect(stats.clients[0].identifier).toBe("10.0.0.1");
    });
  });

  describe("sliding window behavior", () => {
    it("should use sliding window algorithm", async () => {
      vi.useFakeTimers();

      const strictApp = new Hono<Env>();

      const { createRateLimitMiddleware } = await import("../rate-limit");
      // 3 requests per 10 seconds
      const strictMiddleware = createRateLimitMiddleware({ windowMs: 10000, maxRequests: 3 });

      strictApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      strictApp.use("*", strictMiddleware);

      strictApp.get("/api/test", c => c.json({ message: "ok" }));

      // Make 3 requests - should all succeed
      const r1 = await strictApp.request("/api/test");
      const r2 = await strictApp.request("/api/test");
      const r3 = await strictApp.request("/api/test");

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(200);

      // 4th request should be rate limited
      const r4 = await strictApp.request("/api/test");
      expect(r4.status).toBe(429);

      // Advance time by 8 seconds (still within window)
      vi.advanceTimersByTime(8000);

      // Still rate limited (window hasn't fully passed)
      const r5 = await strictApp.request("/api/test");
      expect(r5.status).toBe(429);

      // Advance time by another 3 seconds (now 11 seconds total, past window)
      vi.advanceTimersByTime(3000);

      // Should work again - old requests have fallen out of the window
      const r6 = await strictApp.request("/api/test");
      expect(r6.status).toBe(200);

      vi.useRealTimers();
      strictMiddleware.reset();
    });
  });

  describe("client tracking", () => {
    it("should track multiple clients independently", async () => {
      // Client 1 requests
      await mockApp.request("/api/data", {
        headers: { "X-Forwarded-For": "10.0.0.1" },
      });
      await mockApp.request("/api/data", {
        headers: { "X-Forwarded-For": "10.0.0.1" },
      });

      // Client 2 requests
      await mockApp.request("/api/data", {
        headers: { "X-Forwarded-For": "10.0.0.2" },
      });

      const stats = getRateLimitStats();

      // Should have 2 clients tracked
      expect(stats.totalClients).toBe(2);

      const client1 = stats.clients.find(c => c.identifier === "10.0.0.1");
      const client2 = stats.clients.find(c => c.identifier === "10.0.0.2");

      expect(client1?.recordCount).toBe(2);
      expect(client2?.recordCount).toBe(1);
    });
  });

  describe("error responses", () => {
    it("should include requestId in rate limit error", async () => {
      const strictApp = new Hono<Env>();

      const { createRateLimitMiddleware } = await import("../rate-limit");

      // requestId middleware MUST be before rate limit middleware
      strictApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      const strictMiddleware = createRateLimitMiddleware({ windowMs: 10000, maxRequests: 1 });
      strictApp.use("*", strictMiddleware);

      strictApp.get("/api/test", c => c.json({ message: "ok" }));

      // First request succeeds
      await strictApp.request("/api/test");

      // Second request fails with rate limit
      const response = await strictApp.request("/api/test");
      const data = await response.json();

      expect(data.error.requestId).toBeDefined();

      strictMiddleware.reset();
    });

    it("should return proper error code", async () => {
      const strictApp = new Hono<Env>();

      const { createRateLimitMiddleware } = await import("../rate-limit");
      const strictMiddleware = createRateLimitMiddleware({ windowMs: 10000, maxRequests: 1 });

      strictApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      strictApp.use("*", strictMiddleware);

      strictApp.get("/api/test", c => c.json({ message: "ok" }));

      await strictApp.request("/api/test");
      const response = await strictApp.request("/api/test");
      const data = await response.json();

      expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");

      strictMiddleware.reset();
    });
  });
});
