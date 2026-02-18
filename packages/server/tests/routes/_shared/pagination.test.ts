/**
 * Tests for pagination utility
 */

import { describe, expect, it } from "vitest";
import { parseLimitOffset } from "../../../src/routes/_shared/pagination";

describe("parseLimitOffset", () => {
  it("parses valid limit and offset", () => {
    const result = parseLimitOffset({ limit: "20", offset: "10" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(10);
    }
  });

  it("uses defaults when not provided", () => {
    const result = parseLimitOffset({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    }
  });

  it("rejects non-numeric limit", () => {
    const result = parseLimitOffset({ limit: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Invalid");
    }
  });

  it("rejects negative limit", () => {
    const result = parseLimitOffset({ limit: "-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Limit");
    }
  });

  it("rejects zero limit", () => {
    const result = parseLimitOffset({ limit: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Limit");
    }
  });

  it("rejects limit exceeding maxLimit", () => {
    const result = parseLimitOffset({ limit: "2000" }, { limit: 50, maxLimit: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Limit");
    }
  });

  it("rejects negative offset", () => {
    const result = parseLimitOffset({ offset: "-5" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Offset");
    }
  });

  it("rejects whitespace-only values", () => {
    const result = parseLimitOffset({ limit: "   " });
    expect(result.ok).toBe(false);
  });

  it("allows custom defaults", () => {
    const result = parseLimitOffset({}, { limit: 10, maxLimit: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.limit).toBe(10);
    }
  });
});
