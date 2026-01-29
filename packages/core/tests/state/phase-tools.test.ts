/**
 * Tests for phase-specific tool maps
 */

import { describe, expect, it } from "vitest";
import {
  getAnalyzeCodeToolMap,
  getDesignToolMap,
  getExploreToolMap,
  getImplementToolMap,
  getResearchToolMap,
  getValidateToolMap,
} from "../../src/state/tools/phase-tools";

describe("state/tools/phase-tools", () => {
  describe("getExploreToolMap", () => {
    it("should return explore tools", () => {
      const tools = getExploreToolMap();
      expect(tools).toBeDefined();
      expect(typeof tools).toBe("object");
    });

    it("should include read tools for exploration", () => {
      const tools = getExploreToolMap();
      expect(tools).toHaveProperty("read");
      expect(tools).toHaveProperty("grep");
      expect(tools).toHaveProperty("glob");
      expect(tools).toHaveProperty("ls");
    });

    it("should not include write tools", () => {
      const tools = getExploreToolMap();
      expect(tools).not.toHaveProperty("write");
      expect(tools).not.toHaveProperty("edit");
      expect(tools).not.toHaveProperty("multiedit");
    });

    it("should not include bash tool", () => {
      const tools = getExploreToolMap();
      expect(tools).not.toHaveProperty("bash");
    });
  });

  describe("getAnalyzeCodeToolMap", () => {
    it("should return analyze_code phase tools", () => {
      const tools = getAnalyzeCodeToolMap();
      expect(tools).toBeDefined();
      expect(typeof tools).toBe("object");
    });

    it("should include read and planning tools", () => {
      const tools = getAnalyzeCodeToolMap();
      expect(tools).toHaveProperty("read");
      expect(tools).toHaveProperty("glob");
      expect(tools).toHaveProperty("grep");
      expect(tools).toHaveProperty("ls");
    });

    it("should not include write tools", () => {
      const tools = getAnalyzeCodeToolMap();
      expect(tools).not.toHaveProperty("write");
      expect(tools).not.toHaveProperty("edit");
      expect(tools).not.toHaveProperty("multiedit");
    });

    it("should not include bash tool", () => {
      const tools = getAnalyzeCodeToolMap();
      expect(tools).not.toHaveProperty("bash");
    });
  });

  describe("getResearchToolMap", () => {
    it("should return research phase tools", () => {
      const tools = getResearchToolMap();
      expect(tools).toBeDefined();
      expect(typeof tools).toBe("object");
    });

    it("should include read and research tools", () => {
      const tools = getResearchToolMap();
      expect(tools).toHaveProperty("read");
      expect(tools).toHaveProperty("grep");
      expect(tools).toHaveProperty("glob");
      expect(tools).toHaveProperty("ls");
    });

    it("should not include write tools", () => {
      const tools = getResearchToolMap();
      expect(tools).not.toHaveProperty("write");
      expect(tools).not.toHaveProperty("edit");
      expect(tools).not.toHaveProperty("multiedit");
    });

    it("should not include bash tool", () => {
      const tools = getResearchToolMap();
      expect(tools).not.toHaveProperty("bash");
    });
  });

  describe("getDesignToolMap", () => {
    it("should return design phase tools", () => {
      const tools = getDesignToolMap();
      expect(tools).toBeDefined();
      expect(typeof tools).toBe("object");
    });

    it("should include planning tools", () => {
      const tools = getDesignToolMap();
      expect(tools).toHaveProperty("read");
      expect(tools).toHaveProperty("grep");
      expect(tools).toHaveProperty("glob");
      expect(tools).toHaveProperty("ls");
    });

    it("should not include write tools", () => {
      const tools = getDesignToolMap();
      expect(tools).not.toHaveProperty("write");
      expect(tools).not.toHaveProperty("edit");
      expect(tools).not.toHaveProperty("multiedit");
    });

    it("should not include bash tool", () => {
      const tools = getDesignToolMap();
      expect(tools).not.toHaveProperty("bash");
    });
  });

  describe("getImplementToolMap", () => {
    it("should return implement phase tools", () => {
      const tools = getImplementToolMap();
      expect(tools).toBeDefined();
      expect(typeof tools).toBe("object");
    });

    it("should include write tools", () => {
      const tools = getImplementToolMap();
      expect(tools).toHaveProperty("write");
      expect(tools).toHaveProperty("edit");
      expect(tools).toHaveProperty("multiedit");
    });

    it("should include bash tool", () => {
      const tools = getImplementToolMap();
      expect(tools).toHaveProperty("bash");
    });

    it("should include read tools for verification", () => {
      const tools = getImplementToolMap();
      expect(tools).toHaveProperty("read");
      expect(tools).toHaveProperty("grep");
      expect(tools).toHaveProperty("glob");
      expect(tools).toHaveProperty("ls");
    });
  });

  describe("getValidateToolMap", () => {
    it("should return validate phase tools", () => {
      const tools = getValidateToolMap();
      expect(tools).toBeDefined();
      expect(typeof tools).toBe("object");
    });

    it("should include read and validation tools", () => {
      const tools = getValidateToolMap();
      expect(tools).toHaveProperty("read");
      expect(tools).toHaveProperty("grep");
      expect(tools).toHaveProperty("glob");
      expect(tools).toHaveProperty("ls");
    });

    it("should include bash tool for running tests", () => {
      const tools = getValidateToolMap();
      expect(tools).toHaveProperty("bash");
    });

    it("should not include write tools", () => {
      const tools = getValidateToolMap();
      expect(tools).not.toHaveProperty("write");
      expect(tools).not.toHaveProperty("edit");
      expect(tools).not.toHaveProperty("multiedit");
    });
  });

  describe("Tool routing between phases", () => {
    it("should provide different tool sets for plan vs build phases", () => {
      const planTools = getResearchToolMap();
      const buildTools = getImplementToolMap();

      // Plan phase should not have write
      expect(planTools).not.toHaveProperty("write");
      expect(planTools).not.toHaveProperty("edit");

      // Build phase should have write
      expect(buildTools).toHaveProperty("write");
      expect(buildTools).toHaveProperty("edit");

      // Build phase should have bash
      expect(buildTools).toHaveProperty("bash");
      expect(planTools).not.toHaveProperty("bash");
    });

    it("should ensure all plan phases are read-only", () => {
      const analyzeTools = getAnalyzeCodeToolMap();
      const researchTools = getResearchToolMap();
      const designTools = getDesignToolMap();

      // None of the plan phases should have write access
      expect(analyzeTools).not.toHaveProperty("write");
      expect(researchTools).not.toHaveProperty("write");
      expect(designTools).not.toHaveProperty("write");

      expect(analyzeTools).not.toHaveProperty("edit");
      expect(researchTools).not.toHaveProperty("edit");
      expect(designTools).not.toHaveProperty("edit");

      expect(analyzeTools).not.toHaveProperty("multiedit");
      expect(researchTools).not.toHaveProperty("multiedit");
      expect(designTools).not.toHaveProperty("multiedit");
    });

    it("should ensure build phase has full write capabilities", () => {
      const implementTools = getImplementToolMap();

      // Build phase should have all write tools
      expect(implementTools).toHaveProperty("write");
      expect(implementTools).toHaveProperty("edit");
      expect(implementTools).toHaveProperty("multiedit");
      expect(implementTools).toHaveProperty("bash");

      // Build phase should also have read tools
      expect(implementTools).toHaveProperty("read");
      expect(implementTools).toHaveProperty("grep");
      expect(implementTools).toHaveProperty("glob");
      expect(implementTools).toHaveProperty("ls");
    });

    it("should ensure validate phase is read-only for checking", () => {
      const validateTools = getValidateToolMap();

      // Validate should not have write access
      expect(validateTools).not.toHaveProperty("write");
      expect(validateTools).not.toHaveProperty("edit");
      expect(validateTools).not.toHaveProperty("multiedit");

      // But should have bash for running tests
      expect(validateTools).toHaveProperty("bash");
    });
  });

  describe("Tool map integrity", () => {
    it("should return non-empty tool maps for all phases", () => {
      const exploreTools = getExploreToolMap();
      const analyzeTools = getAnalyzeCodeToolMap();
      const researchTools = getResearchToolMap();
      const designTools = getDesignToolMap();
      const implementTools = getImplementToolMap();
      const validateTools = getValidateToolMap();

      expect(Object.keys(exploreTools).length).toBeGreaterThan(0);
      expect(Object.keys(analyzeTools).length).toBeGreaterThan(0);
      expect(Object.keys(researchTools).length).toBeGreaterThan(0);
      expect(Object.keys(designTools).length).toBeGreaterThan(0);
      expect(Object.keys(implementTools).length).toBeGreaterThan(0);
      expect(Object.keys(validateTools).length).toBeGreaterThan(0);
    });

    it("should include read tools in all phases", () => {
      const allToolMaps = [
        getExploreToolMap(),
        getAnalyzeCodeToolMap(),
        getResearchToolMap(),
        getDesignToolMap(),
        getImplementToolMap(),
        getValidateToolMap(),
      ];

      allToolMaps.forEach(tools => {
        expect(tools).toHaveProperty("read");
      });
    });

    it("should include grep and glob in all phases for search", () => {
      const allToolMaps = [
        getExploreToolMap(),
        getAnalyzeCodeToolMap(),
        getResearchToolMap(),
        getDesignToolMap(),
        getImplementToolMap(),
        getValidateToolMap(),
      ];

      allToolMaps.forEach(tools => {
        expect(tools).toHaveProperty("grep");
        expect(tools).toHaveProperty("glob");
      });
    });
  });
});
