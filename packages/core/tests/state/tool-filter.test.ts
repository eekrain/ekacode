/**
 * Tests for dynamic tool routing and phase-based tool filtering
 */

import { describe, expect, it } from "vitest";
import {
  PHASE_TOOLS,
  getBuildTools,
  getExploreTools,
  getPlanTools,
} from "../../src/state/tools/tool-filter";

describe("state/tools/tool-filter", () => {
  describe("PHASE_TOOLS", () => {
    it("should have tool availability configuration for all phases", () => {
      expect(PHASE_TOOLS).toBeDefined();
      expect(PHASE_TOOLS).toHaveProperty("analyze_code");
      expect(PHASE_TOOLS).toHaveProperty("research");
      expect(PHASE_TOOLS).toHaveProperty("design");
      expect(PHASE_TOOLS).toHaveProperty("implement");
      expect(PHASE_TOOLS).toHaveProperty("validate");
    });

    it("should enable read tools in analyze_code phase", () => {
      expect(PHASE_TOOLS.analyze_code.read).toBe(true);
    });

    it("should disable write tools in plan phases", () => {
      // Plan phases should not have write access
      expect(PHASE_TOOLS.research.write).toBe(false);
      expect(PHASE_TOOLS.design.write).toBe(false);
    });

    it("should enable write tools in implement phase", () => {
      expect(PHASE_TOOLS.implement.write).toBe(true);
    });

    it("should enable research tools in validate phase", () => {
      expect(PHASE_TOOLS.validate.emergency_research).toBe(true);
    });

    it("should enable validation tools only in validate phase", () => {
      expect(PHASE_TOOLS.validate.validation).toBe(true);
      expect(PHASE_TOOLS.implement.validation).toBe(false);
    });
  });

  describe("getPlanTools", () => {
    it("should return tools for analyze_code phase", () => {
      const tools = getPlanTools("analyze_code");
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should return tools for research phase", () => {
      const tools = getPlanTools("research");
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should return tools for design phase", () => {
      const tools = getPlanTools("design");
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should include read tools in all plan phases", () => {
      const analyzeTools = getPlanTools("analyze_code");
      const researchTools = getPlanTools("research");
      const designTools = getPlanTools("design");

      expect(analyzeTools).toContain("readFile");
      expect(researchTools).toContain("readFile");
      expect(designTools).toContain("readFile");
    });

    it("should include research tools only in research and design phases", () => {
      const analyzeTools = getPlanTools("analyze_code");
      const researchTools = getPlanTools("research");
      const designTools = getPlanTools("design");

      expect(analyzeTools).not.toContain("webSearch");
      expect(analyzeTools).not.toContain("webFetch");

      expect(researchTools).toContain("webSearch");
      expect(researchTools).toContain("webFetch");

      expect(designTools).toContain("webSearch");
      expect(designTools).toContain("webFetch");
    });

    it("should include planning tools in all plan phases", () => {
      const analyzeTools = getPlanTools("analyze_code");
      const researchTools = getPlanTools("research");
      const designTools = getPlanTools("design");

      expect(analyzeTools).toContain("sequentialThinking");
      expect(researchTools).toContain("sequentialThinking");
      expect(designTools).toContain("sequentialThinking");
    });

    it("should not include write tools in any plan phase", () => {
      const analyzeTools = getPlanTools("analyze_code");
      const researchTools = getPlanTools("research");
      const designTools = getPlanTools("design");

      expect(analyzeTools).not.toContain("writeFile");
      expect(analyzeTools).not.toContain("editFile");

      expect(researchTools).not.toContain("writeFile");
      expect(researchTools).not.toContain("editFile");

      expect(designTools).not.toContain("writeFile");
      expect(designTools).not.toContain("editFile");
    });
  });

  describe("getBuildTools", () => {
    it("should return tools for implement phase", () => {
      const tools = getBuildTools("implement");
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should return tools for validate phase", () => {
      const tools = getBuildTools("validate");
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should include write tools in implement phase", () => {
      const implementTools = getBuildTools("implement");

      expect(implementTools).toContain("writeFile");
      expect(implementTools).toContain("editFile");
    });

    it("should not include write tools in validate phase", () => {
      const validateTools = getBuildTools("validate");

      expect(validateTools).not.toContain("writeFile");
      expect(validateTools).not.toContain("editFile");
    });

    it("should include read tools in both build phases", () => {
      const implementTools = getBuildTools("implement");
      const validateTools = getBuildTools("validate");

      expect(implementTools).toContain("readFile");
      expect(implementTools).toContain("grep");
      expect(implementTools).toContain("glob");

      expect(validateTools).toContain("readFile");
      expect(validateTools).toContain("grep");
      expect(validateTools).toContain("glob");
    });

    it("should include validation tools only in validate phase", () => {
      const implementTools = getBuildTools("implement");
      const validateTools = getBuildTools("validate");

      expect(implementTools).not.toContain("runTests");
      expect(implementTools).not.toContain("lint");
      expect(implementTools).not.toContain("typecheck");

      expect(validateTools).toContain("runTests");
      expect(validateTools).toContain("lint");
      expect(validateTools).toContain("typecheck");
    });

    it("should include emergency research tools only in validate phase", () => {
      const implementTools = getBuildTools("implement");
      const validateTools = getBuildTools("validate");

      expect(implementTools).not.toContain("webSearch");
      expect(implementTools).not.toContain("webFetch");

      expect(validateTools).toContain("webSearch");
      expect(validateTools).toContain("webFetch");
    });
  });

  describe("getExploreTools", () => {
    it("should return explore-specific tools", () => {
      const tools = getExploreTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should include read-only tools for exploration", () => {
      const tools = getExploreTools();

      expect(tools).toContain("readFile");
      expect(tools).toContain("grep");
      expect(tools).toContain("glob");
      expect(tools).toContain("listFiles");
    });

    it("should not include write tools", () => {
      const tools = getExploreTools();

      expect(tools).not.toContain("writeFile");
      expect(tools).not.toContain("editFile");
    });

    it("should not include validation tools", () => {
      const tools = getExploreTools();

      expect(tools).not.toContain("runTests");
      expect(tools).not.toContain("lint");
      expect(tools).not.toContain("typecheck");
    });

    it("should not include research tools", () => {
      const tools = getExploreTools();

      expect(tools).not.toContain("webSearch");
      expect(tools).not.toContain("webFetch");
    });
  });

  describe("Tool routing between phases", () => {
    it("should provide different tool sets for plan vs build phases", () => {
      const planTools = getPlanTools("research");
      const buildTools = getBuildTools("implement");

      // Plan phase should not have write tools
      expect(planTools).not.toContain("writeFile");
      expect(planTools).not.toContain("editFile");

      // Build phase should have write tools
      expect(buildTools).toContain("writeFile");
      expect(buildTools).toContain("editFile");
    });

    it("should enable research tools in plan phases", () => {
      const analyzeTools = getPlanTools("analyze_code");
      const researchTools = getPlanTools("research");
      const designTools = getPlanTools("design");

      // analyze_code should not have research tools
      expect(analyzeTools).not.toContain("webSearch");

      // research and design should have research tools
      expect(researchTools).toContain("webSearch");
      expect(designTools).toContain("webSearch");
    });

    it("should enable validation tools only in validate phase", () => {
      const implementTools = getBuildTools("implement");
      const validateTools = getBuildTools("validate");

      expect(implementTools).not.toContain("runTests");
      expect(implementTools).not.toContain("lint");
      expect(implementTools).not.toContain("typecheck");

      expect(validateTools).toContain("runTests");
      expect(validateTools).toContain("lint");
      expect(validateTools).toContain("typecheck");
    });
  });

  describe("Tool list integrity", () => {
    it("should return non-empty arrays for all phases", () => {
      const exploreTools = getExploreTools();
      const analyzeTools = getPlanTools("analyze_code");
      const researchTools = getPlanTools("research");
      const designTools = getPlanTools("design");
      const implementTools = getBuildTools("implement");
      const validateTools = getBuildTools("validate");

      expect(exploreTools.length).toBeGreaterThan(0);
      expect(analyzeTools.length).toBeGreaterThan(0);
      expect(researchTools.length).toBeGreaterThan(0);
      expect(designTools.length).toBeGreaterThan(0);
      expect(implementTools.length).toBeGreaterThan(0);
      expect(validateTools.length).toBeGreaterThan(0);
    });

    it("should include read tools in all phases", () => {
      const allToolLists = [
        getExploreTools(),
        getPlanTools("analyze_code"),
        getPlanTools("research"),
        getPlanTools("design"),
        getBuildTools("implement"),
        getBuildTools("validate"),
      ];

      allToolLists.forEach(tools => {
        expect(tools).toContain("readFile");
      });
    });

    it("should include search tools in all phases", () => {
      const allToolLists = [
        getExploreTools(),
        getPlanTools("analyze_code"),
        getPlanTools("research"),
        getPlanTools("design"),
        getBuildTools("implement"),
        getBuildTools("validate"),
      ];

      allToolLists.forEach(tools => {
        expect(tools).toContain("grep");
        expect(tools).toContain("glob");
      });
    });
  });
});
