/**
 * Tests for cache middleware
 *
 * TDD approach: Tests written first to define expected behavior
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Test files use any for simplicity */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../index";

describe("cache middleware", () => {
  let mockApp: Hono<any>;
  let clearCache: () => void;
  let getCacheStats: () => { size: number; maxSize: number; keys: string[] };

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

    // Import and use the cache middleware
    const cacheModule = await import("../cache");
    mockApp.use("*", cacheModule.cacheMiddleware);

    clearCache = cacheModule.clearCache;
    getCacheStats = cacheModule.getCacheStats;

    // Add test endpoints
    mockApp.get("/api/data", c => {
      return c.json({ message: "success", timestamp: Date.now() });
    });

    mockApp.get("/api/slow", c => {
      return c.json({ data: "expensive computation", timestamp: Date.now() });
    });

    mockApp.post("/api/data", c => {
      return c.json({ message: "created" });
    });

    mockApp.get("/api/error", c => {
      return c.json({ error: "not found" }, 404);
    });

    // Clear cache before each test
    clearCache();
  });

  describe("basic caching behavior", () => {
    it("should not cache POST requests", async () => {
      const response1 = await mockApp.request("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: "data" }),
      });

      expect(response1.status).toBe(200);
      expect(response1.headers.get("X-Cache")).toBe("BYPASS");
    });

    it("should cache GET requests on first call (MISS)", async () => {
      const response = await mockApp.request("/api/data");

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Cache")).toBe("MISS");
      const data = await response.json();
      expect(data.message).toBe("success");
    });

    it("should serve from cache on second call (HIT)", async () => {
      // First call - cache miss
      const response1 = await mockApp.request("/api/data");
      const data1 = await response1.json();

      expect(response1.headers.get("X-Cache")).toBe("MISS");
      expect(data1.message).toBe("success");

      // Second call - cache hit
      const response2 = await mockApp.request("/api/data");
      const data2 = await response2.json();

      expect(response2.headers.get("X-Cache")).toBe("HIT");
      expect(data2.message).toBe("success");
      // Timestamp should be identical (cached response)
      expect(data2.timestamp).toBe(data1.timestamp);
    });

    it("should not cache error responses", async () => {
      const response1 = await mockApp.request("/api/error");
      const data1 = await response1.json();

      expect(response1.status).toBe(404);
      expect(response1.headers.get("X-Cache")).toBe("BYPASS");
      expect(data1.error).toBe("not found");

      // Second call should also bypass (not cached)
      const response2 = await mockApp.request("/api/error");

      expect(response2.headers.get("X-Cache")).toBe("BYPASS");
    });
  });

  describe("cache statistics", () => {
    it("should track cache size", async () => {
      expect(getCacheStats().size).toBe(0);

      // Make some requests
      await mockApp.request("/api/data");
      await mockApp.request("/api/slow");

      expect(getCacheStats().size).toBe(2);
    });

    it("should track cached keys", async () => {
      await mockApp.request("/api/data");
      await mockApp.request("/api/slow");

      const stats = getCacheStats();
      expect(stats.keys).toHaveLength(2);
      expect(stats.keys).toContainEqual("GET:/api/data");
      expect(stats.keys).toContainEqual("GET:/api/slow");
    });

    it("should have maxSize limit", async () => {
      const stats = getCacheStats();
      expect(stats.maxSize).toBe(100);
    });
  });

  describe("cache clearing", () => {
    it("should clear all cache entries", async () => {
      // Add some entries
      await mockApp.request("/api/data");
      await mockApp.request("/api/slow");

      expect(getCacheStats().size).toBe(2);

      // Clear cache
      clearCache();

      expect(getCacheStats().size).toBe(0);

      // After clearing, should get MISS again
      const response = await mockApp.request("/api/data");
      expect(response.headers.get("X-Cache")).toBe("MISS");
    });
  });

  describe("custom cache options", () => {
    it("should support custom maxSize", async () => {
      // Create app with custom cache
      const customApp = new Hono<Env>();

      // requestId middleware MUST be before cache middleware for consistent behavior
      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      const { createCacheMiddleware } = await import("../cache");
      customApp.use("*", createCacheMiddleware({ maxSize: 2 }));

      customApp.get("/api/1", c => c.json({ id: 1 }));
      customApp.get("/api/2", c => c.json({ id: 2 }));
      customApp.get("/api/3", c => c.json({ id: 3 }));

      // Fill cache (maxSize = 2)
      await customApp.request("/api/1"); // MISS, cache: [1]
      await customApp.request("/api/2"); // MISS, cache: [1, 2]

      // Access item 1 to make it most recently used
      await customApp.request("/api/1"); // HIT, cache: [2, 1] (1 is now most recent)

      // Add item 3 - should evict item 2 (least recently used), NOT item 1
      await customApp.request("/api/3"); // MISS, evict 2, cache: [1, 3]

      // Item 1 should still be cached (it was recently accessed)
      const response1 = await customApp.request("/api/1");
      expect(response1.headers.get("X-Cache")).toBe("HIT");

      // Item 2 was evicted in step 4, re-adding it evicts item 3
      const response2 = await customApp.request("/api/2");
      expect(response2.headers.get("X-Cache")).toBe("MISS");

      // Item 3 was evicted when item 2 was re-added
      const response3 = await customApp.request("/api/3");
      expect(response3.headers.get("X-Cache")).toBe("MISS");
    });

    it("should support custom TTL", async () => {
      vi.useFakeTimers();

      const customApp = new Hono<Env>();

      const { createCacheMiddleware } = await import("../cache");
      customApp.use("*", createCacheMiddleware({ ttl: 1000 })); // 1 second TTL

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/data", c => c.json({ message: "success" }));

      // First request
      const response1 = await customApp.request("/api/data");
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Before TTL expires - should hit
      const response2 = await customApp.request("/api/data");
      expect(response2.headers.get("X-Cache")).toBe("HIT");

      // Advance past TTL
      vi.advanceTimersByTime(1100);

      // After TTL expires - should miss
      const response3 = await customApp.request("/api/data");
      expect(response3.headers.get("X-Cache")).toBe("MISS");

      vi.useRealTimers();
    });

    it("should support path exclusion", async () => {
      const customApp = new Hono<Env>();

      const { createCacheMiddleware } = await import("../cache");
      customApp.use("*", createCacheMiddleware({ excludePaths: ["/api/no-cache"] }));

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/cached", c => c.json({ message: "cached" }));
      customApp.get("/api/no-cache", c => c.json({ message: "not cached" }));

      // Cached endpoint
      const response1 = await customApp.request("/api/cached");
      const response2 = await customApp.request("/api/cached");
      expect(response1.headers.get("X-Cache")).toBe("MISS");
      expect(response2.headers.get("X-Cache")).toBe("HIT");

      // Excluded endpoint
      const response3 = await customApp.request("/api/no-cache");
      const response4 = await customApp.request("/api/no-cache");
      expect(response3.headers.get("X-Cache")).toBe("BYPASS");
      expect(response4.headers.get("X-Cache")).toBe("BYPASS");
    });

    it("should support caching all responses (not just success)", async () => {
      const customApp = new Hono<Env>();

      const { createCacheMiddleware } = await import("../cache");
      customApp.use("*", createCacheMiddleware({ successOnly: false }));

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/error", c => c.json({ error: "not found" }, 404));

      // First error request
      const response1 = await customApp.request("/api/error");
      expect(response1.headers.get("X-Cache")).toBe("MISS");

      // Second error request should be cached
      const response2 = await customApp.request("/api/error");
      expect(response2.headers.get("X-Cache")).toBe("HIT");
    });
  });

  describe("cache key generation", () => {
    it("should generate different keys for different paths", async () => {
      await mockApp.request("/api/data");
      await mockApp.request("/api/slow");

      const stats = getCacheStats();
      expect(stats.keys).toHaveLength(2);
    });

    it("should include query parameters in cache key", async () => {
      // Create app with request ID
      const customApp = new Hono<Env>();

      const cacheModule = await import("../cache");
      customApp.use("*", cacheModule.cacheMiddleware);

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/data", c => {
        const query = c.req.query();
        return c.json({ query });
      });

      const response1 = await customApp.request("/api/data?foo=bar");
      const response2 = await customApp.request("/api/data?foo=baz");

      // Both should be MISS (different cache keys due to query params)
      expect(response1.headers.get("X-Cache")).toBe("MISS");
      expect(response2.headers.get("X-Cache")).toBe("MISS");

      // Same query should HIT
      const response3 = await customApp.request("/api/data?foo=bar");
      expect(response3.headers.get("X-Cache")).toBe("HIT");
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entry when full", async () => {
      const customApp = new Hono<Env>();

      const { createCacheMiddleware, clearCache: customClear } = await import("../cache");

      customApp.use("*", createCacheMiddleware({ maxSize: 3 }));

      customApp.use("*", async (c, next) => {
        const { v7: uuidv7 } = await import("uuid");
        c.set("requestId", uuidv7());
        await next();
      });

      customApp.get("/api/1", c => c.json({ id: 1 }));
      customApp.get("/api/2", c => c.json({ id: 2 }));
      customApp.get("/api/3", c => c.json({ id: 3 }));
      customApp.get("/api/4", c => c.json({ id: 4 }));

      // Fill cache
      await customApp.request("/api/1"); // Entry 1
      await customApp.request("/api/2"); // Entry 2
      await customApp.request("/api/3"); // Entry 3

      // Access entry 1 to make it more recent
      await customApp.request("/api/1");

      // Add entry 4 - should evict entry 2 (least recently used)
      await customApp.request("/api/4");

      // Entry 2 should be evicted (MISS)
      const response2 = await customApp.request("/api/2");
      expect(response2.headers.get("X-Cache")).toBe("MISS");

      // Entry 1 should still be cached (HIT) - was recently accessed
      const response1 = await customApp.request("/api/1");
      expect(response1.headers.get("X-Cache")).toBe("HIT");

      customClear();
    });
  });
});
