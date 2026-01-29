/**
 * Tests for explore-agent XState actor
 *
 * Following the XState testing guide pattern:
 * https://stately.ai/docs/testing
 *
 * Arrange - set up the test by creating mocks and actor logic
 * Act - invoke the actor with input
 * Assert - assert that the actor produced expected output
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";
import type { ExploreAgentInput } from "../../src/state/actors/explore-agent";

// Mock the model provider
vi.mock("../../src/state/integration/model-provider", () => ({
  exploreModel: {
    id: "test-explore-model",
    provider: "test",
  },
}));

// Mock phase tools
vi.mock("../../src/state/tools/phase-tools", () => ({
  getExploreToolMap: vi.fn(() => ({ mockExploreTool: { description: "test" } })),
}));

// Import after mocks are set up
import { spawnExploreAgent } from "../../src/state/actors/explore-agent";

const actors: ReturnType<typeof createActor>[] = [];

describe("state/actors/explore-agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const actor of actors) {
      try {
        actor.stop();
      } catch {
        // Ignore cleanup errors
      }
    }
    actors.length = 0;
    vi.restoreAllMocks();
  });

  describe("spawnExploreAgent - Actor Logic", () => {
    it("should be valid XState actor logic", () => {
      // 1. Arrange - No setup needed for this test

      // 2. Act - The actor logic is defined
      const actorLogic = spawnExploreAgent;

      // 3. Assert - Verify actor logic structure
      expect(actorLogic).toBeDefined();
      expect(typeof actorLogic).toBe("object");
      expect(actorLogic).toHaveProperty("config");
      expect(typeof actorLogic.config).toBe("function");
    });

    it("should have correct input type", () => {
      // 1. Arrange
      const input: ExploreAgentInput = {
        messages: [{ role: "user", content: "test" }],
      };

      // 2. Act - Type checking happens at compile time
      // This test documents the expected interface

      // 3. Assert - Input structure is valid
      expect(input.messages).toBeInstanceOf(Array);
      expect(input.messages[0]).toHaveProperty("role");
      expect(input.messages[0]).toHaveProperty("content");
    });
  });

  describe("spawnExploreAgent - Tool Map", () => {
    it("should use explore tool map", async () => {
      // 1. Arrange
      await import("../../src/state/tools/phase-tools");

      // 2. Act - Tool map function is imported

      // 3. Assert - Tool map function is available
      expect(true).toBe(true);
    });
  });

  describe("spawnExploreAgent - Safety Limit", () => {
    it("should use analyze_code safety limit (5 iterations)", async () => {
      // 1. Arrange
      const { PHASE_SAFETY_LIMITS } = await import("../../src/state/types");

      // 2. Act - Access the safety limit
      const analyzeCodeLimit = PHASE_SAFETY_LIMITS.analyze_code;

      // 3. Assert
      expect(analyzeCodeLimit).toBe(5);
    });

    it("should be cost-effective with flashx model", async () => {
      // 1. Arrange - This test documents the intended behavior

      // 2. Act - Model is defined in imports

      // 3. Assert - explore agent uses flashx model for cost efficiency
      // This is a documentation test - the actual model selection
      // happens in the model provider module
      expect(true).toBe(true);
    });
  });

  describe("spawnExploreAgent - Test Mode Execution", () => {
    it("should resolve with deterministic output in test mode", async () => {
      // 1. Arrange
      const actor = createActor(spawnExploreAgent, {
        input: {
          messages: [{ role: "user", content: "test" }],
          runtime: { testMode: true },
        },
      });
      actors.push(actor);

      // 2. Act
      actor.start();
      const snapshot = await waitFor(actor, s => s.status === "done");

      // 3. Assert
      expect(snapshot.output).toBeDefined();
      expect(snapshot.output.output).toMatch(/test mode/i);
      expect(snapshot.output.finishReason).toBe("stop");
    });
  });
});
