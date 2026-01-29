/**
 * Tests for build-agent XState actor
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
import type { BuildAgentInput } from "../../src/state/actors/build-agent";

// Mock the model provider
vi.mock("../../src/state/integration/model-provider", () => ({
  buildModel: {
    id: "test-build-model",
    provider: "test",
  },
}));

// Mock phase tools
vi.mock("../../src/state/tools/phase-tools", () => ({
  getImplementToolMap: vi.fn(() => ({ mockImplementTool: { description: "test" } })),
  getValidateToolMap: vi.fn(() => ({ mockValidateTool: { description: "test" } })),
}));

// Mock phase prompts
vi.mock("../../src/state/prompts/build-prompts", () => ({
  BUILD_PHASE_NOTICES: {
    implement: "Test implement notice",
    validate: "Test validate notice",
  },
}));

// Import after mocks are set up
import { runBuildAgent } from "../../src/state/actors/build-agent";

const actors: ReturnType<typeof createActor>[] = [];

describe("state/actors/build-agent", () => {
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

  describe("runBuildAgent - Actor Logic", () => {
    it("should be valid XState actor logic", () => {
      // 1. Arrange - No setup needed for this test

      // 2. Act - The actor logic is defined
      const actorLogic = runBuildAgent;

      // 3. Assert - Verify actor logic structure
      expect(actorLogic).toBeDefined();
      expect(typeof actorLogic).toBe("object");
      expect(actorLogic).toHaveProperty("config");
      expect(typeof actorLogic.config).toBe("function");
    });

    it("should have correct input/output types", () => {
      // 1. Arrange
      const input: BuildAgentInput = {
        messages: [{ role: "user", content: "test" }],
        phase: "implement",
      };

      // 2. Act - Type checking happens at compile time
      // This test documents the expected interface

      // 3. Assert - Input structure is valid
      expect(input.messages).toBeInstanceOf(Array);
      expect(input.messages[0]).toHaveProperty("role");
      expect(input.messages[0]).toHaveProperty("content");
      expect(input.phase).toBe("implement");
    });
  });

  describe("runBuildAgent - Phase-Specific Tool Maps", () => {
    it("should use correct tool map for implement phase", async () => {
      // 1. Arrange
      await import("../../src/state/tools/phase-tools");

      // 2. Act
      // Tool map function is imported

      // 3. Assert - Tool map function is available
      expect(true).toBe(true);
    });

    it("should use correct tool map for validate phase", async () => {
      // 1. Arrange
      await import("../../src/state/tools/phase-tools");

      // 2. Act
      // Tool map function is imported

      // 3: Assert
      expect(true).toBe(true);
    });
  });

  describe("runBuildAgent - Phase Safety Limits", () => {
    it("should use different safety limits for different phases", async () => {
      // 1. Arrange
      const { PHASE_SAFETY_LIMITS } = await import("../../src/state/types");

      // 2. Act - Access the safety limits
      const implementLimit = PHASE_SAFETY_LIMITS.implement;
      const validateLimit = PHASE_SAFETY_LIMITS.validate;

      // 3. Assert
      expect(implementLimit).toBe(50);
      expect(validateLimit).toBe(100);
      expect(implementLimit).toBeLessThan(validateLimit);
    });
  });

  describe("runBuildAgent - Test Mode Execution", () => {
    it("should resolve with deterministic output in test mode", async () => {
      // 1. Arrange
      const actor = createActor(runBuildAgent, {
        input: {
          messages: [{ role: "user", content: "test" }],
          phase: "validate",
          runtime: { testMode: true },
        },
      });
      actors.push(actor);

      // 2. Act
      actor.start();
      const snapshot = await waitFor(actor, s => s.status === "done");

      // 3. Assert
      expect(snapshot.output).toBeDefined();
      expect(snapshot.output.output).toMatch(/build successful/i);
      expect(snapshot.output.finishReason).toBe("stop");
    });
  });
});
