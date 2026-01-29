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
 * Get credentials from environment
 *
 * Reads fresh from environment each call to support test env changes.
 */
function getCredentials(): { username: string; password: string } {
  const username = process.env.EKACODE_USERNAME;
  const password = process.env.EKACODE_PASSWORD;

  if (!username || !password) {
    throw new Error("EKACODE_USERNAME and EKACODE_PASSWORD must be set");
  }

  return { username, password };
}

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

  let configuredCredentials: { username: string; password: string };
  try {
    configuredCredentials = getCredentials();
  } catch {
    logger.error("Auth configuration missing", undefined, {
      module: "auth",
      requestId,
      path: c.req.path,
    });
    return c.json(
      {
        error: {
          code: "CONFIG_ERROR",
          message: "Server authentication is not configured",
          requestId,
        },
      },
      500
    );
  }

  // Check for Authorization header
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    logger.warn("Missing Authorization header", {
      module: "auth",
      requestId,
      path: c.req.path,
    });

    return c.json(createUnauthorizedResponse(requestId, "Missing credentials"), 401);
  }

  // Check for Basic Auth format (must start with "Basic ")
  if (!authHeader.startsWith("Basic ")) {
    logger.warn("Invalid Authorization format", {
      module: "auth",
      requestId,
      path: c.req.path,
    });

    return c.json(createUnauthorizedResponse(requestId, "Missing credentials"), 401);
  }

  // Parse and validate credentials
  const credentials = parseBasicAuth(authHeader);

  if (
    !credentials ||
    credentials.username !== configuredCredentials.username ||
    credentials.password !== configuredCredentials.password
  ) {
    logger.warn("Invalid credentials", {
      module: "auth",
      requestId,
      path: c.req.path,
    });

    return c.json(createUnauthorizedResponse(requestId, "Invalid credentials"), 401);
  }

  // Credentials are valid
  logger.debug("Request authenticated", {
    module: "auth",
    requestId,
    path: c.req.path,
  });

  await next();
}
