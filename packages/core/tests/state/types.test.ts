/**
 * Tests for XState machine types
 */

import { describe, expect, it } from "vitest";
import type {
  AgentMode,
  BuildPhase,
  HierarchicalState,
  PlanPhase,
  RLMMachineContext,
  RLMMachineEvent,
  TerminalState,
} from "../../src/state/types";

describe("state/types", () => {
  describe("AgentMode", () => {
    it("should have 'plan' and 'build' modes", () => {
      const planMode: AgentMode = "plan";
      const buildMode: AgentMode = "build";

      expect(planMode).toBe("plan");
      expect(buildMode).toBe("build");
    });
  });

  describe("PlanPhase", () => {
    it("should have analyze_code, research, and design phases", () => {
      const analyze: PlanPhase = "analyze_code";
      const research: PlanPhase = "research";
      const design: PlanPhase = "design";

      expect(analyze).toBe("analyze_code");
      expect(research).toBe("research");
      expect(design).toBe("design");
    });
  });

  describe("BuildPhase", () => {
    it("should have implement and validate phases", () => {
      const implement: BuildPhase = "implement";
      const validate: BuildPhase = "validate";

      expect(implement).toBe("implement");
      expect(validate).toBe("validate");
    });
  });

  describe("TerminalState", () => {
    it("should have done and failed states", () => {
      const done: TerminalState = "done";
      const failed: TerminalState = "failed";

      expect(done).toBe("done");
      expect(failed).toBe("failed");
    });
  });

  describe("HierarchicalState", () => {
    it("should accept plan mode with phase", () => {
      const planState: HierarchicalState = { mode: "plan", phase: "analyze_code" };

      expect(planState.mode).toBe("plan");
      expect(planState.phase).toBe("analyze_code");
    });

    it("should accept build mode with phase", () => {
      const buildState: HierarchicalState = { mode: "build", phase: "implement" };

      expect(buildState.mode).toBe("build");
      expect(buildState.phase).toBe("implement");
    });

    it("should accept terminal states", () => {
      const doneState: HierarchicalState = "done";
      const failedState: HierarchicalState = "failed";

      expect(doneState).toBe("done");
      expect(failedState).toBe("failed");
    });
  });

  describe("RLMMachineContext", () => {
    it("should accept valid context", () => {
      const context: RLMMachineContext = {
        messages: [],
        goal: "test goal",
        iterationCount: 0,
        recentStates: [],
        lastState: null,
        toolExecutionCount: 0,
        errorCounts: {},
      };

      expect(context.goal).toBe("test goal");
      expect(context.iterationCount).toBe(0);
      expect(context.messages).toEqual([]);
    });
  });

  describe("RLMMachineEvent", () => {
    it("should accept SPAWN_EXPLORE_COMPLETE event", () => {
      const event: RLMMachineEvent = {
        type: "SPAWN_EXPLORE_COMPLETE",
        result: "explore result",
      };

      expect(event.type).toBe("SPAWN_EXPLORE_COMPLETE");
      if (event.type === "SPAWN_EXPLORE_COMPLETE") {
        expect(event.result).toBe("explore result");
      }
    });

    it("should accept PLAN_AGENT_COMPLETE event", () => {
      const event: RLMMachineEvent = {
        type: "PLAN_AGENT_COMPLETE",
        phase: "research",
        content: "research result",
      };

      expect(event.type).toBe("PLAN_AGENT_COMPLETE");
      if (event.type === "PLAN_AGENT_COMPLETE") {
        expect(event.phase).toBe("research");
        expect(event.content).toBe("research result");
      }
    });

    it("should accept BUILD_AGENT_COMPLETE event", () => {
      const event: RLMMachineEvent = {
        type: "BUILD_AGENT_COMPLETE",
        phase: "implement",
        content: "implementation result",
      };

      expect(event.type).toBe("BUILD_AGENT_COMPLETE");
      if (event.type === "BUILD_AGENT_COMPLETE") {
        expect(event.phase).toBe("implement");
        expect(event.content).toBe("implementation result");
      }
    });

    it("should accept DOOM_LOOP_DETECTED event", () => {
      const event: RLMMachineEvent = { type: "DOOM_LOOP_DETECTED" };

      expect(event.type).toBe("DOOM_LOOP_DETECTED");
    });

    it("should accept COMPLETE event", () => {
      const event: RLMMachineEvent = { type: "COMPLETE" };

      expect(event.type).toBe("COMPLETE");
    });

    it("should accept FAIL event", () => {
      const event: RLMMachineEvent = { type: "FAIL", error: "test error" };

      expect(event.type).toBe("FAIL");
      if (event.type === "FAIL") {
        expect(event.error).toBe("test error");
      }
    });
  });
});
