import { beforeEach, describe, expect, it } from "vitest";
import { FileIndex } from "../file-index";

describe("FileIndex", () => {
  let index: FileIndex;

  beforeEach(() => {
    index = new FileIndex();
  });

  it("should add a file to the index", () => {
    index.add("/test-project", "/test-project/src/index.ts");
    const results = index.search("/test-project", "index");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should remove a file from the index", () => {
    index.add("/test-project", "/test-project/src/index.ts");
    index.remove("/test-project", "/test-project/src/index.ts");
    const results = index.search("/test-project", "index");
    expect(results.length).toBe(0);
  });

  it("should search with fuzzy matching including whitespace", () => {
    index.add("/test-project", "/test-project/src/components/UserAuth.tsx");
    const results = index.search("/test-project", "user auth");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should filter blocklisted paths", () => {
    index.add("/test-project", "/test-project/node_modules/package/index.js");
    index.add("/test-project", "/test-project/src/index.ts");
    const results = index.search("/test-project", "index");
    expect(results.length).toBe(1);
    expect(results[0].path).toBe("/test-project/src/index.ts");
  });

  it("should return empty array for non-existent directory", () => {
    const results = index.search("/non-existent", "index");
    expect(results).toEqual([]);
  });

  it("should index and search directories alongside files", () => {
    index.add("/test-project", "/test-project/src", "directory");
    index.add("/test-project", "/test-project/src/index.ts", "file");

    const results = index.search("/test-project", "src");
    const directoryResult = results.find(result => result.type === "directory");
    const fileResult = results.find(result => result.type === "file");

    expect(directoryResult).toBeDefined();
    expect(directoryResult?.path).toBe("/test-project/src");
    expect(fileResult).toBeDefined();
    expect(fileResult?.path).toBe("/test-project/src/index.ts");
  });

  it("should prioritize basename prefix matches over deeper path matches", () => {
    index.add("/test-project", "/test-project/src/components/Button.tsx");
    index.add("/test-project", "/test-project/packages/button-system/docs/readme.md");

    const results = index.search("/test-project", "button");
    expect(results.length).toBeGreaterThan(1);
    expect(results[0]?.path).toBe("/test-project/src/components/Button.tsx");
  });
});
