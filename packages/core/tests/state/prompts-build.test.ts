/**
 * Tests for build phase system prompts
 */

import { describe, expect, it } from "vitest";
import {
  BUILD_PHASE_NOTICES,
  getImplementPrompt,
  getValidatePrompt,
} from "../../src/state/prompts/build-prompts";

describe("state/prompts/build-prompts", () => {
  describe("BUILD_PHASE_NOTICES", () => {
    it("should have notices for all build phases", () => {
      expect(BUILD_PHASE_NOTICES).toBeDefined();
      expect(BUILD_PHASE_NOTICES).toHaveProperty("implement");
      expect(BUILD_PHASE_NOTICES).toHaveProperty("validate");
    });

    it("should have implement phase description", () => {
      expect(BUILD_PHASE_NOTICES.implement).toBeDefined();
      expect(typeof BUILD_PHASE_NOTICES.implement).toBe("string");
      expect(BUILD_PHASE_NOTICES.implement.length).toBeGreaterThan(0);
    });

    it("should have validate phase description", () => {
      expect(BUILD_PHASE_NOTICES.validate).toBeDefined();
      expect(typeof BUILD_PHASE_NOTICES.validate).toBe("string");
      expect(BUILD_PHASE_NOTICES.validate.length).toBeGreaterThan(0);
    });
  });

  describe("getImplementPrompt", () => {
    it("should return implement phase prompt", () => {
      const prompt = getImplementPrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should mention implementation or code", () => {
      const prompt = getImplementPrompt();
      expect(prompt.toLowerCase()).toMatch(/implement|code|write/);
    });
  });

  describe("getValidatePrompt", () => {
    it("should return validate phase prompt", () => {
      const prompt = getValidatePrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should mention validation or testing", () => {
      const prompt = getValidatePrompt();
      expect(prompt.toLowerCase()).toMatch(/validat|test|check/);
    });
  });
});
