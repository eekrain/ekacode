/**
 * Tests for error handler middleware
 *
 * TDD approach: Tests written first to define expected behavior
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Test files use any for simplicity */

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/index";

describe("error handler middleware", () => {
  let mockApp: Hono<any>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create a test app with request logging (sets requestId)
    mockApp = new Hono<Env>();

    // Add request logging middleware first (sets requestId)
    mockApp.use("*", async (c, next) => {
      const { v7: uuidv7 } = await import("uuid");
      const requestId = uuidv7();
      c.set("requestId", requestId);
      await next();
    });

    // Import and use the error handler with onError
    const { errorHandler } = await import("../../src/middleware/error-handler");
    mockApp.onError(errorHandler);

    // Add test endpoints
    mockApp.get("/ok", c => {
      return c.json({ message: "success" });
    });

    mockApp.get("/error", () => {
      throw new Error("Test error");
    });

    mockApp.get("/validation", async () => {
      const { ValidationError } = await import("../../src/types");
      throw new ValidationError("Invalid input", { field: "email" });
    });

    mockApp.get("/auth", async () => {
      const { AuthorizationError } = await import("../../src/types");
      throw new AuthorizationError("Not authenticated");
    });

    mockApp.get("/notfound", async () => {
      const { NotFoundError } = await import("../../src/types");
      throw new NotFoundError("Resource");
    });
  });

  describe("successful requests", () => {
    it("should pass through successful responses", async () => {
      const response = await mockApp.request("/ok");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("success");
    });
  });

  describe("ValidationError (400)", () => {
    it("should return 400 with error details", async () => {
      const response = await mockApp.request("/validation");
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(data.error.message).toBe("Invalid input");
      expect(data.error.requestId).toBeDefined();
      expect(data.error.details).toEqual({ field: "email" });
    });
  });

  describe("AuthorizationError (401)", () => {
    it("should return 401", async () => {
      const response = await mockApp.request("/auth");
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("UNAUTHORIZED");
      expect(data.error.message).toBe("Not authenticated");
      expect(data.error.requestId).toBeDefined();
    });
  });

  describe("NotFoundError (404)", () => {
    it("should return 404", async () => {
      const response = await mockApp.request("/notfound");
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe("NOT_FOUND");
      expect(data.error.message).toBe("Resource not found");
      expect(data.error.requestId).toBeDefined();
    });
  });

  describe("generic Error (500)", () => {
    it("should return 500 with safe message", async () => {
      const response = await mockApp.request("/error");
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe("INTERNAL_ERROR");
      expect(data.error.message).toBe("An unexpected error occurred");
      expect(data.error.requestId).toBeDefined();
      // Error details should NOT be leaked
      expect(data.error.details).toBeUndefined();
      // Original error message should NOT be leaked
      expect(data.error.message).not.toBe("Test error");
    });
  });
});
