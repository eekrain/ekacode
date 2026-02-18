/**
 * Tests for directory resolver utility
 */

import { describe, expect, it } from "vitest";
import { resolveDirectory } from "../../../src/routes/_shared/directory-resolver";

describe("resolveDirectory", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMockContext = (queryDir?: string, contextDir?: string): any => {
    return {
      req: {
        query: (key: string) => (key === "directory" ? queryDir : undefined),
      },
      get: (key: string) => (key === "instanceContext" ? { directory: contextDir } : undefined),
    };
  };

  it("returns directory from query parameter", () => {
    const c = createMockContext("/custom/path");
    const result = resolveDirectory(c, { allowFallbackCwd: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.directory).toBe("/custom/path");
    }
  });

  it("falls back to cwd when allowFallbackCwd is true and no other directory", () => {
    const c = createMockContext(undefined, undefined);
    const result = resolveDirectory(c, { allowFallbackCwd: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.directory).toBe(process.cwd());
    }
  });

  it("returns error when no directory available and fallback not allowed", () => {
    const c = createMockContext(undefined, undefined);
    const result = resolveDirectory(c);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("required");
    }
  });

  it("rejects empty whitespace directory", () => {
    const c = createMockContext("   ");
    const result = resolveDirectory(c);
    expect(result.ok).toBe(false);
  });

  it("rejects null character in directory", () => {
    const c = createMockContext("/path/with\x00null");
    const result = resolveDirectory(c);
    expect(result.ok).toBe(false);
  });

  it("falls back to instanceContext when no query parameter", () => {
    const c = createMockContext(undefined, "/context/path");
    const result = resolveDirectory(c);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.directory).toBe("/context/path");
    }
  });
});
