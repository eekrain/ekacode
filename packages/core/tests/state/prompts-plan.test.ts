/**
 * Tests for plan phase system prompts
 */

import { describe, expect, it } from "vitest";
import {
  PLAN_PHASE_NOTICES,
  getAnalyzeCodePrompt,
  getDesignPrompt,
  getResearchPrompt,
} from "../../src/state/prompts/plan-prompts";

describe("state/prompts/plan-prompts", () => {
  describe("PLAN_PHASE_NOTICES", () => {
    it("should have notices for all plan phases", () => {
      expect(PLAN_PHASE_NOTICES).toBeDefined();
      expect(PLAN_PHASE_NOTICES).toHaveProperty("analyze_code");
      expect(PLAN_PHASE_NOTICES).toHaveProperty("research");
      expect(PLAN_PHASE_NOTICES).toHaveProperty("design");
    });

    it("should have analyze_code phase description", () => {
      expect(PLAN_PHASE_NOTICES.analyze_code).toBeDefined();
      expect(typeof PLAN_PHASE_NOTICES.analyze_code).toBe("string");
      expect(PLAN_PHASE_NOTICES.analyze_code.length).toBeGreaterThan(0);
    });

    it("should have research phase description", () => {
      expect(PLAN_PHASE_NOTICES.research).toBeDefined();
      expect(typeof PLAN_PHASE_NOTICES.research).toBe("string");
      expect(PLAN_PHASE_NOTICES.research.length).toBeGreaterThan(0);
    });

    it("should have design phase description", () => {
      expect(PLAN_PHASE_NOTICES.design).toBeDefined();
      expect(typeof PLAN_PHASE_NOTICES.design).toBe("string");
      expect(PLAN_PHASE_NOTICES.design.length).toBeGreaterThan(0);
    });
  });

  describe("getAnalyzeCodePrompt", () => {
    it("should return analyze_code phase prompt", () => {
      const prompt = getAnalyzeCodePrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should mention explore subagent", () => {
      const prompt = getAnalyzeCodePrompt();
      expect(prompt.toLowerCase()).toContain("explore");
    });
  });

  describe("getResearchPrompt", () => {
    it("should return research phase prompt", () => {
      const prompt = getResearchPrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should mention web search or research", () => {
      const prompt = getResearchPrompt();
      expect(prompt.toLowerCase()).toMatch(/research|search/);
    });
  });

  describe("getDesignPrompt", () => {
    it("should return design phase prompt", () => {
      const prompt = getDesignPrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should mention planning or design", () => {
      const prompt = getDesignPrompt();
      expect(prompt.toLowerCase()).toMatch(/design|planning|plan/);
    });
  });
});
