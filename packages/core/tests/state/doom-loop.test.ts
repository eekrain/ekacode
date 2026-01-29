/**
 * Tests for doom loop detection guards
 */

import { describe, expect, it } from "vitest";
import {
  countBuildOscillations,
  doomLoopGuard,
  hasValidationErrors,
  isBuildClean,
} from "../../src/state/guards/doom-loop";
import type { RLMMachineContext } from "../../src/state/types";

describe("state/guards/doom-loop", () => {
  describe("doomLoopGuard", () => {
    it("should detect oscillation doom loop", () => {
      const context: RLMMachineContext = {
        messages: [],
        goal: "test",
        iterationCount: 10,
        recentStates: [
          { state: "build.implement", timestamp: Date.now() - 1000 },
          { state: "build.validate", timestamp: Date.now() - 2000 },
          { state: "build.implement", timestamp: Date.now() - 3000 },
          { state: "build.validate", timestamp: Date.now() - 4000 },
          { state: "build.implement", timestamp: Date.now() - 5000 },
          { state: "build.validate", timestamp: Date.now() - 6000 },
        ],
        lastState: "build.implement",
        toolExecutionCount: 10,
        errorCounts: {},
      };

      const result = doomLoopGuard(context);
      expect(result.isDoomLoop).toBe(true);
      expect(result.reason).toMatch(/oscillation/i);
    });

    it("should not trigger doom loop for normal progress", () => {
      const context: RLMMachineContext = {
        messages: [],
        goal: "test",
        iterationCount: 3,
        recentStates: [
          { state: "build.implement", timestamp: Date.now() - 1000 },
          { state: "build.validate", timestamp: Date.now() - 2000 },
        ],
        lastState: "build.validate",
        toolExecutionCount: 3,
        errorCounts: {},
      };

      const result = doomLoopGuard(context);
      expect(result.isDoomLoop).toBe(false);
    });
  });

  describe("hasValidationErrors", () => {
    it("should detect validation errors in LSP output", () => {
      const lspOutput = `
file.ts:5:3 - error TS2322: Type 'string' is not assignable to type 'number'.
file.ts:10:1 - error TS7001: Binding element 'foo' implicitly has an 'any' type.
      `;

      expect(hasValidationErrors(lspOutput)).toBe(true);
    });

    it("should return false for clean LSP output", () => {
      const lspOutput = "No errors found. All checks passed.";

      expect(hasValidationErrors(lspOutput)).toBe(false);
    });

    it("should return false for empty output", () => {
      expect(hasValidationErrors("")).toBe(false);
    });
  });

  describe("isBuildClean", () => {
    it("should detect successful build indicators", () => {
      const output = "Build completed successfully. All tests passed.";

      expect(isBuildClean(output)).toBe(true);
    });

    it("should return false for failed builds", () => {
      const output = "Build failed with 3 errors.";

      expect(isBuildClean(output)).toBe(false);
    });

    it("should return false for empty output", () => {
      expect(isBuildClean("")).toBe(false);
    });
  });

  describe("countBuildOscillations", () => {
    it("should count implement → validate transitions", () => {
      const recentStates = [
        { state: "build.implement", timestamp: Date.now() - 1000 },
        { state: "build.validate", timestamp: Date.now() - 2000 },
        { state: "build.implement", timestamp: Date.now() - 3000 },
        { state: "build.validate", timestamp: Date.now() - 4000 },
        { state: "build.implement", timestamp: Date.now() - 5000 },
      ];

      const count = countBuildOscillations(recentStates);
      expect(count).toBe(4); // 4 transitions
    });

    it("should return 0 for empty state history", () => {
      const count = countBuildOscillations([]);
      expect(count).toBe(0);
    });

    it("should ignore non-build states", () => {
      const recentStates = [
        { state: "plan.research", timestamp: Date.now() - 1000 },
        { state: "plan.design", timestamp: Date.now() - 2000 },
      ];

      const count = countBuildOscillations(recentStates);
      expect(count).toBe(0);
    });
  });
});
