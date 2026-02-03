/**
 * Basic Auth middleware
 *
 * Validates requests using HTTP Basic Authentication.
 * Skips auth for /api/health endpoint.
 */

import { createLogger } from "@ekacode/shared/logger";
import type { Context, Next } from "hono";
import type { Env } from "../index";
import type { ErrorResponse } from "../types";

const logger = createLogger("server:auth");

/**
 * Parse Basic Auth credentials from header
 *
 * @param authHeader - The Authorization header value
 * @returns Parsed credentials or null if invalid
 */
function parseBasicAuth(authHeader: string): { username: string; password: string } | null {
  if (!authHeader.startsWith("Basic ")) {
    return null;
  }

  // Extract base64 token
  const b64Token = authHeader.slice(6);

  try {
    // Decode base64
    const decoded = Buffer.from(b64Token, "base64").toString("utf-8");

    // Split on first colon only (username may contain colons)
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) {
      return null;
    }

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    return { username, password };
  } catch {
    return null;
  }
}

/**
 * Create an unauthorized error response
 *
 * @param requestId - Request ID for tracing
 * @param message - Error message
 * @returns Error response object
 */
function createUnauthorizedResponse(requestId: string, message: string): ErrorResponse {
  return {
    error: {
      code: "UNAUTHORIZED",
      message,
      requestId,
    },
  };
}

/**
 * Basic Auth middleware
 *
 * Validates requests using HTTP Basic Authentication.
 * Skips auth for /api/health endpoint.
 *
 * @param c - Hono context
 * @param next - Next middleware in chain
 */
// Basic Auth middleware
export async function authMiddleware(c: Context<Env>, next: Next): Promise<Response | void> {
  const requestId = c.get("requestId");

  // Skip auth for health endpoint
  if (c.req.path === "/api/health") {
    logger.debug("Health check - skipping auth", {
      module: "auth",
      requestId,
      path: c.req.path,
    });
    return next();
  }

  // Check for Authorization header
  const authHeader = c.req.header("Authorization");
  const queryToken = c.req.query("token");

  // Get server token for validation
  const serverToken = (await import("../index")).getServerToken();

  // Case 1: Authorization Header (Standard)
  if (authHeader) {
    if (!authHeader.startsWith("Basic ")) {
      logger.warn("Invalid Authorization format", {
        module: "auth",
        requestId,
        path: c.req.path,
      });
      return c.json(createUnauthorizedResponse(requestId, "Missing credentials"), 401);
    }

    const credentials = parseBasicAuth(authHeader);
    if (!credentials || credentials.password !== serverToken) {
      logger.warn("Invalid credentials", {
        module: "auth",
        requestId,
        path: c.req.path,
      });
      return c.json(createUnauthorizedResponse(requestId, "Invalid credentials"), 401);
    }
  }
  // Case 2: Query Parameter (SSE/EventSource)
  else if (queryToken) {
    if (queryToken !== serverToken) {
      logger.warn("Invalid token parameter", {
        module: "auth",
        requestId,
        path: c.req.path,
      });
      return c.json(createUnauthorizedResponse(requestId, "Invalid token"), 401);
    }
  }
  // Case 3: Missing Credentials
  else {
    logger.warn("Missing credentials", {
      module: "auth",
      requestId,
      path: c.req.path,
    });
    return c.json(createUnauthorizedResponse(requestId, "Missing credentials"), 401);
  }

  // Credentials are valid
  logger.debug("Request authenticated", {
    module: "auth",
    requestId,
    path: c.req.path,
  });

  await next();
}
