/**
 * Tests for intent-based loop control
 */

import { describe, expect, it } from "vitest";
import { checkLoopControl, PHASE_SAFETY_LIMITS } from "../../src/state/loop-control";
import type { BuildPhase, PlanPhase } from "../../src/state/types";

describe("state/loop-control", () => {
  describe("checkLoopControl", () => {
    it("should stop when finishReason is 'stop'", () => {
      const result = checkLoopControl({
        iterationCount: 1,
        finishReason: "stop",
        safetyLimit: 100,
        phaseName: "research",
      });

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toBe("Agent signaled completion");
    });

    it("should continue when finishReason is 'tool-calls'", () => {
      const result = checkLoopControl({
        iterationCount: 5,
        finishReason: "tool-calls",
        safetyLimit: 100,
        phaseName: "research",
      });

      expect(result.shouldContinue).toBe(true);
      expect(result.reason).toBe("Agent has more tool calls");
    });

    it("should continue when finishReason is null", () => {
      const result = checkLoopControl({
        iterationCount: 5,
        finishReason: null,
        safetyLimit: 100,
        phaseName: "research",
      });

      expect(result.shouldContinue).toBe(true);
      expect(result.reason).toBe("Still streaming");
    });

    it("should continue when finishReason is undefined", () => {
      const result = checkLoopControl({
        iterationCount: 5,
        finishReason: undefined,
        safetyLimit: 100,
        phaseName: "research",
      });

      expect(result.shouldContinue).toBe(true);
      expect(result.reason).toBe("Still streaming");
    });

    it("should stop when safety limit is reached", () => {
      const result = checkLoopControl({
        iterationCount: 100,
        finishReason: null,
        safetyLimit: 100,
        phaseName: "research",
      });

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toBe("Safety limit reached");
    });

    it("should continue when under safety limit", () => {
      const result = checkLoopControl({
        iterationCount: 99,
        finishReason: "tool-calls",
        safetyLimit: 100,
        phaseName: "research",
      });

      expect(result.shouldContinue).toBe(true);
      expect(result.reason).toBe("Agent has more tool calls");
    });

    it("should prioritize finishReason over safety limit", () => {
      const result = checkLoopControl({
        iterationCount: 150,
        finishReason: "stop",
        safetyLimit: 100,
        phaseName: "research",
      });

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toBe("Agent signaled completion");
    });
  });

  describe("PHASE_SAFETY_LIMITS", () => {
    it("should have safety limits for all plan phases", () => {
      const planPhases: PlanPhase[] = ["analyze_code", "research", "design"];

      for (const phase of planPhases) {
        expect(PHASE_SAFETY_LIMITS[phase]).toBeDefined();
        expect(PHASE_SAFETY_LIMITS[phase]).toBeGreaterThan(0);
      }
    });

    it("should have safety limits for all build phases", () => {
      const buildPhases: BuildPhase[] = ["implement", "validate"];

      for (const phase of buildPhases) {
        expect(PHASE_SAFETY_LIMITS[phase]).toBeDefined();
        expect(PHASE_SAFETY_LIMITS[phase]).toBeGreaterThan(0);
      }
    });

    it("should have small limit for analyze_code", () => {
      expect(PHASE_SAFETY_LIMITS.analyze_code).toBe(5);
    });

    it("should have large limits for research and design", () => {
      expect(PHASE_SAFETY_LIMITS.research).toBe(100);
      expect(PHASE_SAFETY_LIMITS.design).toBe(100);
    });

    it("should have moderate limit for implement", () => {
      expect(PHASE_SAFETY_LIMITS.implement).toBe(50);
    });

    it("should have large limit for validate", () => {
      expect(PHASE_SAFETY_LIMITS.validate).toBe(100);
    });
  });
});
