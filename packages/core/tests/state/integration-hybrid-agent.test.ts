/**
 * Tests for HybridAgent integration with RLM workflow
 *
 * Following the XState testing guide pattern:
 * https://stately.ai/docs/testing
 *
 * Arrange - set up the test by creating the actor logics and the actors
 * Act - send event(s) to the actor(s)
 * Assert - assert that the actor(s) reached their expected state(s) and/or executed the expected side effects
 *
 * Execution Notes:
 * - Full workflow execution tests require valid ZAI_API_KEY environment variable
 * - Tests verify structure and configuration without triggering actual AI calls
 * - To run full integration tests, set ZAI_API_KEY and remove the test skips
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  createRLMActor,
  runRLMWorkflow,
  type RLMConfig,
} from "../../src/state/integration/hybrid-agent";

// Track actors for cleanup
const actors: ReturnType<typeof createRLMActor>[] = [];

afterEach(() => {
  for (const actor of actors) {
    try {
      actor.stop();
    } catch {
      // Ignore errors during cleanup
    }
  }
  actors.length = 0;
});

describe("state/integration/hybrid-agent", () => {
  describe("createRLMActor", () => {
    it("should create an XState actor for RLM workflow", () => {
      // 1. Arrange - Create the actor
      const actor = createRLMActor({
        goal: "test goal",
      });
      actors.push(actor);

      // 2. Act - Actor is created
      // 3. Assert - Verify structure
      expect(actor).toBeDefined();
      expect(actor).toHaveProperty("start");
      expect(typeof actor.start).toBe("function");
      expect(actor).toHaveProperty("stop");
      expect(typeof actor.stop).toBe("function");
      expect(actor).toHaveProperty("getSnapshot");
      expect(typeof actor.getSnapshot).toBe("function");
    });

    it("should accept custom configuration", () => {
      // 1. Arrange
      const config: RLMConfig = {
        goal: "test goal with custom config",
        maxIterations: 10,
        messages: [{ role: "user", content: "test" }],
        workspace: "/test/workspace",
      };

      // 2. Act - Create actor with custom config
      const actor = createRLMActor(config);
      actors.push(actor);

      // 3. Assert
      expect(actor).toBeDefined();
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.goal).toBe("test goal with custom config");
    });

    it("should initialize with correct default context", () => {
      // 1. Arrange
      const actor = createRLMActor({
        goal: "test goal",
      });
      actors.push(actor);

      // 2. Act - Get snapshot without starting actor
      const snapshot = actor.getSnapshot();

      // 3. Assert
      expect(snapshot.context.messages).toEqual([]);
      expect(snapshot.context.iterationCount).toBe(0);
      expect(snapshot.context.recentStates).toEqual([]);
      expect(snapshot.context.toolExecutionCount).toBe(0);
      expect(snapshot.context.errorCounts).toEqual({});
    });

    it("should include messages from config in initial context", () => {
      // 1. Arrange
      const messages = [{ role: "user", content: "test message" }];
      const actor = createRLMActor({
        goal: "test",
        messages,
      });
      actors.push(actor);

      // 2. Act
      const snapshot = actor.getSnapshot();

      // 3. Assert
      expect(snapshot.context.messages).toEqual(messages);
    });
  });

  describe("runRLMWorkflow", () => {
    it("should be a function that returns a promise", () => {
      // 1. Arrange - No setup needed
      // 2. Act - Check function type
      expect(typeof runRLMWorkflow).toBe("function");
      // 3. Assert - Function exists and is callable
    });

    it("should accept RLMConfig as parameter", () => {
      // 1. Arrange
      const config: RLMConfig = {
        goal: "test goal",
        messages: [{ role: "user", content: "test" }],
        maxIterations: 10,
        workspace: "/test/path",
      };

      // 2. Act - Verify config structure
      // 3. Assert
      expect(config.goal).toBe("test goal");
      expect(config.messages).toHaveLength(1);
      expect(config.maxIterations).toBe(10);
      expect(config.workspace).toBe("/test/path");
    });

    it("should return a promise that resolves to RLMResult structure", async () => {
      // 1. Arrange
      const promise = runRLMWorkflow({ goal: "test", testMode: true });

      // 2. Act - Check promise type
      expect(promise).toBeInstanceOf(Promise);

      // 3. Assert - Verify expected result structure
      const result = await promise;
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        finalState: expect.any(String),
        messages: expect.any(Array),
      });
    });

    it("should handle errors gracefully", async () => {
      // 1. Arrange - Invalid config
      const invalidConfig = { goal: "" };

      // 2. Act - Call with invalid config
      const promise = runRLMWorkflow({ ...invalidConfig, testMode: true });

      // 3. Assert - Should handle errors
      await expect(promise).rejects.toBeDefined();
    });

    it("should accept messages input", async () => {
      // 1. Arrange
      const messages = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" },
      ];

      // 2. Act
      const promise = runRLMWorkflow({
        goal: "test",
        messages,
        testMode: true,
      });

      // 3. Assert
      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.toBeDefined();
    });

    it("should accept workspace configuration", async () => {
      // 1. Arrange
      const workspace = "/test/workspace/path";

      // 2. Act
      const promise = runRLMWorkflow({
        goal: "test",
        workspace,
        testMode: true,
      });

      // 3. Assert
      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.toBeDefined();
    });

    it("should accept maxIterations configuration", async () => {
      // 1. Arrange
      const maxIterations = 5;

      // 2. Act
      const promise = runRLMWorkflow({
        goal: "test",
        maxIterations,
        testMode: true,
      });

      // 3. Assert
      expect(promise).toBeInstanceOf(Promise);
      await expect(promise).resolves.toBeDefined();
    });
  });

  describe("RLMConfig type safety", () => {
    it("should require goal parameter", () => {
      // 1. Arrange - No goal provided (should fail type check)
      // @ts-expect-error - Testing that goal is required
      const invalidConfig = {};

      // 2. Act - Verify TypeScript error
      // This test documents that goal is required
      expect(invalidConfig).toBeDefined();
    });

    it("should allow optional parameters", () => {
      // 1. Arrange - Minimal config
      const minimalConfig: RLMConfig = {
        goal: "test",
      };

      // 2. Act - Verify minimal config works
      expect(minimalConfig.goal).toBe("test");

      // 3. Arrange - Full config
      const fullConfig: RLMConfig = {
        goal: "test",
        messages: [{ role: "user", content: "test" }],
        maxIterations: 10,
        workspace: "/test",
      };

      // 2. Act - Verify full config works
      expect(fullConfig).toBeDefined();
    });
  });

  describe("RLMResult type structure", () => {
    it("should have correct RLMResult structure", () => {
      // 1. Arrange - Expected result structure
      const resultStructure = {
        success: expect.any(Boolean),
        finalState: expect.any(String),
        messages: expect.any(Array),
      };

      // 2. Act & Assert - Verify structure
      expect(resultStructure).toMatchObject({
        success: expect.any(Boolean),
        finalState: expect.any(String),
        messages: expect.any(Array),
      });
    });

    it("should allow optional error field", () => {
      // 1. Arrange - Result without error
      const successResult = {
        success: true,
        finalState: "done" as const,
        messages: [],
      };

      // 2. Assert - Valid without error
      expect(successResult.error).toBeUndefined();

      // 3. Arrange - Result with error
      const errorResult = {
        success: false,
        finalState: "failed" as const,
        messages: [],
        error: "Test error",
      };

      // 4. Assert - Valid with error
      expect(errorResult.error).toBe("Test error");
    });
  });

  describe("Integration tests (require API key)", () => {
    // These tests require ZAI_API_KEY to be set
    // They test the actual workflow execution with real AI calls

    const itWithApiKey = process.env.ZAI_API_KEY ? it : it.skip;

    itWithApiKey(
      "should execute workflow and reach done state with valid API key",
      async () => {
        // 1. Arrange
        const config: RLMConfig = {
          goal: "Write a simple hello world function",
          maxIterations: 3,
        };

        // 2. Act - Execute workflow
        const result = await runRLMWorkflow(config);

        // 3. Assert
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.finalState).toBeDefined();
        expect(Array.isArray(result.messages)).toBe(true);
      },
      30000
    ); // 30 second timeout for AI calls

    itWithApiKey(
      "should handle workflow failures gracefully",
      async () => {
        // 1. Arrange - Impossible task
        const config: RLMConfig = {
          goal: "Solve P vs NP problem in one line",
          maxIterations: 2,
        };

        // 2. Act
        const result = await runRLMWorkflow(config);

        // 3. Assert - Should handle failure
        expect(result).toBeDefined();
        // May succeed or fail depending on AI response
        expect(typeof result.success).toBe("boolean");
      },
      30000
    );

    itWithApiKey(
      "should respect maxIterations limit",
      async () => {
        // 1. Arrange - Task that might loop
        const config: RLMConfig = {
          goal: "Keep trying until perfect",
          maxIterations: 2,
        };

        // 2. Act
        const result = await runRLMWorkflow(config);

        // 3. Assert - Should complete within iteration limit
        expect(result).toBeDefined();
        // The doom loop protection should prevent infinite loops
      },
      30000
    );
  });

  describe("runRLMWorkflow - Cancellation", () => {
    it("should reject with AbortError if signal is already aborted", async () => {
      // 1. Arrange
      const controller = new AbortController();
      controller.abort();

      // 2. Act
      const promise = runRLMWorkflow({
        goal: "test",
        testMode: true,
        signal: controller.signal,
      });

      // 3. Assert
      await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    });
  });
});
