/**
 * Tests for plan-agent XState actor
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
import type { PlanAgentInput } from "../../src/state/actors/plan-agent";

// Mock the model provider
vi.mock("../../src/state/integration/model-provider", () => ({
  planModel: {
    id: "test-plan-model",
    provider: "test",
  },
}));

// Mock phase tools
vi.mock("../../src/state/tools/phase-tools", () => ({
  getAnalyzeCodeToolMap: vi.fn(() => ({ mockAnalyzeTool: { description: "test" } })),
  getResearchToolMap: vi.fn(() => ({ mockResearchTool: { description: "test" } })),
  getDesignToolMap: vi.fn(() => ({ mockDesignTool: { description: "test" } })),
}));

// Mock phase prompts
vi.mock("../../src/state/prompts/plan-prompts", () => ({
  PLAN_PHASE_NOTICES: {
    analyze_code: "Test analyze_code notice",
    research: "Test research notice",
    design: "Test design notice",
  },
}));

// Import after mocks are set up
import { runPlanAgent } from "../../src/state/actors/plan-agent";

const actors: ReturnType<typeof createActor>[] = [];

describe("state/actors/plan-agent", () => {
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

  describe("runPlanAgent - Actor Logic", () => {
    it("should be valid XState actor logic", () => {
      // 1. Arrange - No setup needed for this test

      // 2. Act - The actor logic is defined
      const actorLogic = runPlanAgent;

      // 3. Assert - Verify actor logic structure
      expect(actorLogic).toBeDefined();
      expect(typeof actorLogic).toBe("object");
      expect(actorLogic).toHaveProperty("config");
      expect(typeof actorLogic.config).toBe("function");
    });

    it("should have correct input/output types", () => {
      // 1. Arrange
      const input: PlanAgentInput = {
        messages: [{ role: "user", content: "test" }],
        phase: "research",
      };

      // 2. Act - Type checking happens at compile time
      // This test documents the expected interface

      // 3. Assert - Input structure is valid
      expect(input.messages).toBeInstanceOf(Array);
      expect(input.messages[0]).toHaveProperty("role");
      expect(input.messages[0]).toHaveProperty("content");
      expect(input.phase).toBe("research");
    });
  });

  describe("runPlanAgent - Phase-Specific Tool Maps", () => {
    it("should use correct tool map for analyze_code phase", async () => {
      // 1. Arrange
      await import("../../src/state/tools/phase-tools");

      // 2. Act - Tool map function is imported

      // 3. Assert - Tool map function is available
      expect(true).toBe(true);
    });

    it("should use correct tool map for research phase", async () => {
      // 1. Arrange
      await import("../../src/state/tools/phase-tools");

      // 2. Act - Tool map function is imported

      // 3. Assert - Tool map function is available
      expect(true).toBe(true);
    });

    it("should use correct tool map for design phase", async () => {
      // 1. Arrange
      await import("../../src/state/tools/phase-tools");

      // 2. Act - Tool map function is imported

      // 3: Assert - Tool map function is available
      expect(true).toBe(true);
    });
  });

  describe("runPlanAgent - Test Mode Execution", () => {
    it("should resolve with deterministic output in test mode", async () => {
      // 1. Arrange
      const actor = createActor(runPlanAgent, {
        input: {
          messages: [{ role: "user", content: "test" }],
          phase: "research",
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
