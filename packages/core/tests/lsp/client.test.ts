import { describe, expect, it, vi } from "vitest";
import type { LSPHandle } from "../../src/lsp/client";

describe("LSPClient", () => {
  describe("interface", () => {
    it("should export LSPHandle interface", () => {
      const handle: LSPHandle = {
        process: {
          pid: 123,
          kill: vi.fn(),
          on: vi.fn(),
          stdout: null,
          stderr: null,
          stdin: null,
        } as unknown as LSPHandle["process"],
        initializationOptions: {},
      };
      expect(handle).toBeDefined();
      expect(handle.process).toBeDefined();
      expect(handle.initializationOptions).toEqual({});
    });
  });
});
