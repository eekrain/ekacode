/**
 * Context store tests
 *
 * TDD: Tests written first to define expected behavior
 */

import { describe, expect, it } from "vitest";
import { hasContext, runWithContext } from "./context";

describe("AsyncLocalStorage Context", () => {
  describe("context propagation", () => {
    it("propagates context through async/await", async () => {
      await runWithContext(
        {
          directory: "/test",
          sessionID: "session-123",
          messageID: "msg-456",
          createdAt: Date.now(),
        },
        async () => {
          expect(hasContext()).toBe(true);

          // Context persists through async operations
          await Promise.resolve();
          expect(hasContext()).toBe(true);
        }
      );

      // Context is cleaned up after execution
      expect(hasContext()).toBe(false);
    });

    it("propagates context through promise chains", async () => {
      const results: string[] = [];

      await runWithContext(
        {
          directory: "/test",
          sessionID: "session-123",
          messageID: "msg-456",
          createdAt: Date.now(),
        },
        async () => {
          return Promise.resolve()
            .then(() => {
              expect(hasContext()).toBe(true);
              results.push("then-1");
            })
            .then(() => {
              expect(hasContext()).toBe(true);
              results.push("then-2");
            });
        }
      );

      expect(results).toEqual(["then-1", "then-2"]);
    });

    it("propagates context through setTimeout", async () => {
      let inTimeout = false;

      await runWithContext(
        {
          directory: "/test",
          sessionID: "session-123",
          messageID: "msg-456",
          createdAt: Date.now(),
        },
        () => {
          return new Promise<void>(resolve => {
            setTimeout(() => {
              inTimeout = hasContext();
              resolve();
            }, 10);
          });
        }
      );

      expect(inTimeout).toBe(true);
    });
  });

  describe("context isolation", () => {
    it("isolates context between concurrent operations", async () => {
      const contexts: string[] = [];

      await Promise.all([
        runWithContext(
          {
            directory: "/a",
            sessionID: "session-a",
            messageID: "msg-a",
            createdAt: Date.now(),
          },
          async () => {
            contexts.push("/a");
            await Promise.resolve();
            contexts.push("/a");
          }
        ),
        runWithContext(
          {
            directory: "/b",
            sessionID: "session-b",
            messageID: "msg-b",
            createdAt: Date.now(),
          },
          async () => {
            contexts.push("/b");
            await Promise.resolve();
            contexts.push("/b");
          }
        ),
      ]);

      expect(contexts).toEqual(["/a", "/b", "/a", "/b"]);
    });

    it("isolates context between sequential operations", async () => {
      const contexts: string[] = [];

      await runWithContext(
        {
          directory: "/first",
          sessionID: "session-1",
          messageID: "msg-1",
          createdAt: Date.now(),
        },
        async () => {
          contexts.push("/first");
        }
      );

      await runWithContext(
        {
          directory: "/second",
          sessionID: "session-2",
          messageID: "msg-2",
          createdAt: Date.now(),
        },
        async () => {
          contexts.push("/second");
        }
      );

      expect(contexts).toEqual(["/first", "/second"]);
    });
  });

  describe("context lifecycle", () => {
    it("returns value from context", async () => {
      const result = await runWithContext(
        {
          directory: "/test",
          sessionID: "session-123",
          messageID: "msg-456",
          createdAt: Date.now(),
        },
        async () => {
          return "success";
        }
      );

      expect(result).toBe("success");
    });

    it("propagates errors from context", async () => {
      await expect(
        runWithContext(
          {
            directory: "/test",
            sessionID: "session-123",
            messageID: "msg-456",
            createdAt: Date.now(),
          },
          async () => {
            throw new Error("test error");
          }
        )
      ).rejects.toThrow("test error");
    });

    it("cleans up context after execution", async () => {
      await runWithContext(
        {
          directory: "/test",
          sessionID: "session-123",
          messageID: "msg-456",
          createdAt: Date.now(),
        },
        async () => {
          expect(hasContext()).toBe(true);
        }
      );

      expect(hasContext()).toBe(false);
    });
  });

  describe("hasContext", () => {
    it("returns false outside of context", () => {
      expect(hasContext()).toBe(false);
    });

    it("returns true inside context", async () => {
      await runWithContext(
        {
          directory: "/test",
          sessionID: "session-123",
          messageID: "msg-456",
          createdAt: Date.now(),
        },
        async () => {
          expect(hasContext()).toBe(true);
        }
      );
    });

    it("returns false after context cleanup", async () => {
      await runWithContext(
        {
          directory: "/test",
          sessionID: "session-123",
          messageID: "msg-456",
          createdAt: Date.now(),
        },
        async () => {
          // inside context
        }
      );

      expect(hasContext()).toBe(false);
    });
  });
});
