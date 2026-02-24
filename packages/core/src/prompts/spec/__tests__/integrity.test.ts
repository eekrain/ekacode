/**
 * Prompt Integrity Tests
 *
 * T-014 - Add prompt integrity and snapshot tests
 * Validates that prompt pack modules contain required sections
 * and follow consistent structure.
 */

import { describe, expect, it } from "vitest";

describe("Spec Prompt Pack Integrity", () => {
  const REQUIRED_SECTIONS = [
    "Role",
    "Mission",
    "SuccessCriteria",
    "HardConstraints",
    "OutputSummarySchema",
  ];

  const REQUIRED_POLICIES = [
    "Non-negotiable rules:",
    "Required context loading sequence:",
    "Formatting constraints:",
    "Traceability rules:",
    "Fallback behavior:",
  ];

  describe("requirements prompt", () => {
    let prompt: typeof import("@/prompts/spec/requirements").SPEC_REQUIREMENTS_GENERATOR_PROMPT;

    it("should export requirements prompt", async () => {
      const p = await import("@/prompts/spec/requirements");
      prompt = p.SPEC_REQUIREMENTS_GENERATOR_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should contain required sections", async () => {
      const p = await import("@/prompts/spec/requirements");
      prompt = p.SPEC_REQUIREMENTS_GENERATOR_PROMPT;

      for (const section of REQUIRED_SECTIONS) {
        expect(prompt).toContain(`<${section}>`);
        expect(prompt).toContain(`</${section}>`);
      }
    });

    it("should include shared policies", async () => {
      const p = await import("@/prompts/spec/requirements");
      prompt = p.SPEC_REQUIREMENTS_GENERATOR_PROMPT;

      for (const policy of REQUIRED_POLICIES) {
        expect(prompt).toContain(policy);
      }
    });
  });

  describe("design prompt", () => {
    let prompt: typeof import("@/prompts/spec/design").SPEC_DESIGN_GENERATOR_PROMPT;

    it("should export design prompt", async () => {
      const p = await import("@/prompts/spec/design");
      prompt = p.SPEC_DESIGN_GENERATOR_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should contain required sections", async () => {
      const p = await import("@/prompts/spec/design");
      prompt = p.SPEC_DESIGN_GENERATOR_PROMPT;

      for (const section of REQUIRED_SECTIONS) {
        expect(prompt).toContain(`<${section}>`);
        expect(prompt).toContain(`</${section}>`);
      }
    });

    it("should include shared policies", async () => {
      const p = await import("@/prompts/spec/design");
      prompt = p.SPEC_DESIGN_GENERATOR_PROMPT;

      for (const policy of REQUIRED_POLICIES) {
        expect(prompt).toContain(policy);
      }
    });
  });

  describe("tasks prompt", () => {
    let prompt: typeof import("@/prompts/spec/tasks").SPEC_TASKS_GENERATOR_PROMPT;

    it("should export tasks prompt", async () => {
      const p = await import("@/prompts/spec/tasks");
      prompt = p.SPEC_TASKS_GENERATOR_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should contain required sections", async () => {
      const p = await import("@/prompts/spec/tasks");
      prompt = p.SPEC_TASKS_GENERATOR_PROMPT;

      for (const section of REQUIRED_SECTIONS) {
        expect(prompt).toContain(`<${section}>`);
        expect(prompt).toContain(`</${section}>`);
      }
    });

    it("should include shared policies", async () => {
      const p = await import("@/prompts/spec/tasks");
      prompt = p.SPEC_TASKS_GENERATOR_PROMPT;

      for (const policy of REQUIRED_POLICIES) {
        expect(prompt).toContain(policy);
      }
    });
  });

  describe("shared policies", () => {
    it("should export all shared policy blocks", async () => {
      const shared = await import("@/prompts/spec/shared");
      expect(shared.SPEC_CORE_POLICY).toBeDefined();
      expect(shared.SPEC_CONTEXT_LOADING).toBeDefined();
      expect(shared.SPEC_FORMAT_RULES).toBeDefined();
      expect(shared.SPEC_TRACEABILITY_RULES).toBeDefined();
      expect(shared.SPEC_SAFETY_AND_FALLBACK).toBeDefined();
    });

    it("should export SHARED_POLICIES array", async () => {
      const shared = await import("@/prompts/spec/shared");
      expect(shared.SHARED_POLICIES).toBeDefined();
      expect(Array.isArray(shared.SHARED_POLICIES)).toBe(true);
      expect(shared.SHARED_POLICIES).toHaveLength(5);
    });

    it("should export buildPromptWithPolicies function", async () => {
      const shared = await import("@/prompts/spec/shared");
      expect(typeof shared.buildPromptWithPolicies).toBe("function");
    });

    it("buildPromptWithPolicies should include all policies", async () => {
      const shared = await import("@/prompts/spec/shared");
      const result = shared.buildPromptWithPolicies("Part1", "Part2");

      expect(result).toContain("Part1");
      expect(result).toContain("Part2");

      for (const policy of REQUIRED_POLICIES) {
        expect(result).toContain(policy);
      }
    });

    it("core policy should contain all non-negotiable rules", async () => {
      const shared = await import("@/prompts/spec/shared");
      const policy = shared.SPEC_CORE_POLICY;

      expect(policy).toContain("Read-first / write-last");
      expect(policy).toContain("Phase integrity");
      expect(policy).toContain("Deterministic structure");
      expect(policy).toContain("Traceability");
      expect(policy).toContain("Explainable decisions");
      expect(policy).toContain("Fail loud on missing prerequisites");
    });

    it("traceability rules should require requirement mapping", async () => {
      const shared = await import("@/prompts/spec/shared");
      const rules = shared.SPEC_TRACEABILITY_RULES;

      expect(rules).toContain("Every major requirement must map to at least one design element");
      expect(rules).toContain("Every task must include requirement references");
    });
  });

  describe("gap validation prompt", () => {
    let prompt: typeof import("@/prompts/spec/gap").SPEC_GAP_ANALYZER_PROMPT;

    it("should export gap validation prompt", async () => {
      const p = await import("@/prompts/spec/gap");
      prompt = p.SPEC_GAP_ANALYZER_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
    });

    it("should contain Role and Mission sections", async () => {
      const p = await import("@/prompts/spec/gap");
      prompt = p.SPEC_GAP_ANALYZER_PROMPT;

      expect(prompt).toContain("<Role>");
      expect(prompt).toContain("</Role>");
      expect(prompt).toContain("<Mission>");
      expect(prompt).toContain("</Mission>");
    });
  });

  describe("design validation prompt", () => {
    let prompt: typeof import("@/prompts/spec/design-validate").SPEC_DESIGN_VALIDATOR_PROMPT;

    it("should export design validation prompt", async () => {
      const p = await import("@/prompts/spec/design-validate");
      prompt = p.SPEC_DESIGN_VALIDATOR_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
    });

    it("should contain required sections", async () => {
      const p = await import("@/prompts/spec/design-validate");
      prompt = p.SPEC_DESIGN_VALIDATOR_PROMPT;

      expect(prompt).toContain("<Role>");
      expect(prompt).toContain("<Mission>");
      expect(prompt).toContain("<SuccessCriteria>");
      expect(prompt).toContain("<OutputSummarySchema>");
    });
  });

  describe("implementation validation prompt", () => {
    let prompt: typeof import("@/prompts/spec/impl-validate").SPEC_IMPL_VALIDATOR_PROMPT;

    it("should export impl validation prompt", async () => {
      const p = await import("@/prompts/spec/impl-validate");
      prompt = p.SPEC_IMPL_VALIDATOR_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
    });

    it("should contain required sections", async () => {
      const p = await import("@/prompts/spec/impl-validate");
      prompt = p.SPEC_IMPL_VALIDATOR_PROMPT;

      expect(prompt).toContain("<Role>");
      expect(prompt).toContain("<Mission>");
      expect(prompt).toContain("<SuccessCriteria>");
      expect(prompt).toContain("<OutputSummarySchema>");
    });
  });

  describe("quick prompt", () => {
    let prompt: typeof import("@/prompts/spec/quick").SPEC_QUICK_ORCHESTRATOR_PROMPT;

    it("should export quick prompt", async () => {
      const p = await import("@/prompts/spec/quick");
      prompt = p.SPEC_QUICK_ORCHESTRATOR_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
    });
  });

  describe("status prompt", () => {
    let prompt: typeof import("@/prompts/spec/status").SPEC_STATUS_REPORTER_PROMPT;

    it("should export status prompt", async () => {
      const p = await import("@/prompts/spec/status");
      prompt = p.SPEC_STATUS_REPORTER_PROMPT;
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe("string");
    });
  });
});
