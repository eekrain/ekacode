/**
 * Shared route utilities - Pagination
 */

export interface PaginationResult {
  ok: true;
  limit: number;
  offset: number;
}

export interface PaginationError {
  ok: false;
  reason: string;
}

export type PaginationParseResult = PaginationResult | PaginationError;

export interface PaginationDefaults {
  limit: number;
  maxLimit: number;
}

/**
 * Parse and validate limit/offset query parameters
 *
 * @param query - Record of query parameters
 * @param defaults - Default values (limit: 50, maxLimit: 1000)
 * @returns Parsed pagination or error
 */
export function parseLimitOffset(
  query: Record<string, string | undefined>,
  defaults: PaginationDefaults = { limit: 50, maxLimit: 1000 }
): PaginationParseResult {
  const rawLimit = query.limit?.trim();
  const rawOffset = query.offset?.trim();

  if (rawLimit !== undefined) {
    const limit = Number(rawLimit);
    if (isNaN(limit)) {
      return { ok: false, reason: "Invalid limit parameter" };
    }
    if (limit < 1) {
      return { ok: false, reason: "Limit must be greater than 0" };
    }
    if (limit > defaults.maxLimit) {
      return { ok: false, reason: `Limit exceeds maximum of ${defaults.maxLimit}` };
    }
    return {
      ok: true,
      limit,
      offset: rawOffset !== undefined ? Number(rawOffset) : 0,
    };
  }

  if (rawOffset !== undefined) {
    const offsetNum = Number(rawOffset);
    if (isNaN(offsetNum)) {
      return { ok: false, reason: "Invalid offset parameter" };
    }
    if (offsetNum < 0) {
      return { ok: false, reason: "Offset must be non-negative" };
    }
    return { ok: true, limit: defaults.limit, offset: offsetNum };
  }

  return { ok: true, limit: defaults.limit, offset: 0 };
}
