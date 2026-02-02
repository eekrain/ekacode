/**
 * Tests for agent factory and configuration
 *
 * These tests validate the agent factory functions and configuration
 * for creating different agent types.
 */

import { describe, expect, it } from "vitest";
import {
  createAgent,
  createBuildAgent,
  createExploreAgent,
  createPlanAgent,
  PHASE_ITERATION_LIMITS,
  PHASE_MODELS,
  PHASE_PROMPTS,
} from "../../../src/agent/workflow/factory";

describe("agent/factory", () => {
  describe("PHASE_MODELS", () => {
    it("should have models for all agent types", () => {
      expect(PHASE_MODELS).toHaveProperty("explore");
      expect(PHASE_MODELS).toHaveProperty("plan");
      expect(PHASE_MODELS).toHaveProperty("build");

      expect(PHASE_MODELS.explore).toBeTypeOf("string");
      expect(PHASE_MODELS.plan).toBeTypeOf("string");
      expect(PHASE_MODELS.build).toBeTypeOf("string");
    });

    it("should use cost-effective model for explore", () => {
      expect(PHASE_MODELS.explore).toBe("glm-4.7-flashx");
    });

    it("should use high-quality model for plan", () => {
      expect(PHASE_MODELS.plan).toBe("glm-4.7");
    });

    it("should use fast model for build", () => {
      expect(PHASE_MODELS.build).toBe("glm-4.7-flash");
    });
  });

  describe("PHASE_ITERATION_LIMITS", () => {
    it("should have limits for all agent types", () => {
      expect(PHASE_ITERATION_LIMITS).toHaveProperty("explore");
      expect(PHASE_ITERATION_LIMITS).toHaveProperty("plan");
      expect(PHASE_ITERATION_LIMITS).toHaveProperty("build");

      expect(PHASE_ITERATION_LIMITS.explore).toBeTypeOf("number");
      expect(PHASE_ITERATION_LIMITS.plan).toBeTypeOf("number");
      expect(PHASE_ITERATION_LIMITS.build).toBeTypeOf("number");
    });

    it("should have reasonable iteration limits", () => {
      expect(PHASE_ITERATION_LIMITS.explore).toBeGreaterThan(0);
      expect(PHASE_ITERATION_LIMITS.plan).toBeGreaterThan(0);
      expect(PHASE_ITERATION_LIMITS.build).toBeGreaterThan(0);
    });
  });

  describe("PHASE_PROMPTS", () => {
    it("should have prompts for all agent types", () => {
      expect(PHASE_PROMPTS).toHaveProperty("explore");
      expect(PHASE_PROMPTS).toHaveProperty("plan");
      expect(PHASE_PROMPTS).toHaveProperty("build");

      expect(PHASE_PROMPTS.explore).toBeTypeOf("string");
      expect(PHASE_PROMPTS.plan).toBeTypeOf("string");
      expect(PHASE_PROMPTS.build).toBeTypeOf("string");
    });

    it("should have non-empty prompts", () => {
      expect(PHASE_PROMPTS.explore.length).toBeGreaterThan(0);
      expect(PHASE_PROMPTS.plan.length).toBeGreaterThan(0);
      expect(PHASE_PROMPTS.build.length).toBeGreaterThan(0);
    });

    it("should mention exploration in explore prompt", () => {
      expect(PHASE_PROMPTS.explore.toLowerCase()).toContain("explor");
    });

    it("should mention planning in plan prompt", () => {
      expect(PHASE_PROMPTS.plan.toLowerCase()).toContain("plan");
    });

    it("should mention implementation in build prompt", () => {
      expect(PHASE_PROMPTS.build.toLowerCase()).toMatch(/implement|build|code/);
    });
  });

  describe("createAgent", () => {
    it("should create explore agent with correct defaults", () => {
      const agent = createAgent("explore", "test-explore-1");

      expect(agent.id).toBe("test-explore-1");
      expect(agent.type).toBe("explore");
      expect(agent.model).toBe(PHASE_MODELS.explore);
      expect(agent.systemPrompt).toBe(PHASE_PROMPTS.explore);
      expect(agent.maxIterations).toBe(PHASE_ITERATION_LIMITS.explore);
    });

    it("should create plan agent with correct defaults", () => {
      const agent = createAgent("plan", "test-plan-1");

      expect(agent.id).toBe("test-plan-1");
      expect(agent.type).toBe("plan");
      expect(agent.model).toBe(PHASE_MODELS.plan);
      expect(agent.systemPrompt).toBe(PHASE_PROMPTS.plan);
      expect(agent.maxIterations).toBe(PHASE_ITERATION_LIMITS.plan);
    });

    it("should create build agent with correct defaults", () => {
      const agent = createAgent("build", "test-build-1");

      expect(agent.id).toBe("test-build-1");
      expect(agent.type).toBe("build");
      expect(agent.model).toBe(PHASE_MODELS.build);
      expect(agent.systemPrompt).toBe(PHASE_PROMPTS.build);
      expect(agent.maxIterations).toBe(PHASE_ITERATION_LIMITS.build);
    });

    it("should accept custom config overrides", () => {
      const agent = createAgent("explore", "test-custom", {
        maxIterations: 100,
        temperature: 0.5,
      });

      expect(agent.id).toBe("test-custom");
      expect(agent.maxIterations).toBe(100);
      expect(agent.temperature).toBe(0.5);
    });

    it("should have tools from phase configuration", () => {
      const agent = createAgent("explore", "test-tools");

      // Explore agents should have read-only tools
      expect(agent.tools).toBeDefined();
      expect(Array.isArray(agent.tools)).toBe(true);
      expect(agent.tools.length).toBeGreaterThan(0);
    });
  });

  describe("createExploreAgent", () => {
    it("should create explore agent with index in id", () => {
      const agent1 = createExploreAgent(0);
      const agent2 = createExploreAgent(1);
      const agent3 = createExploreAgent(2);

      expect(agent1.id).toBe("explore-0");
      expect(agent1.type).toBe("explore");
      expect(agent2.id).toBe("explore-1");
      expect(agent2.type).toBe("explore");
      expect(agent3.id).toBe("explore-2");
      expect(agent3.type).toBe("explore");
    });

    it("should use explore model and prompts", () => {
      const agent = createExploreAgent(0);

      expect(agent.model).toBe(PHASE_MODELS.explore);
      expect(agent.systemPrompt).toBe(PHASE_PROMPTS.explore);
    });
  });

  describe("createPlanAgent", () => {
    it("should create plan agent with planner id", () => {
      const agent = createPlanAgent();

      expect(agent.id).toBe("planner");
      expect(agent.type).toBe("plan");
    });

    it("should use plan model and prompts", () => {
      const agent = createPlanAgent();

      expect(agent.model).toBe(PHASE_MODELS.plan);
      expect(agent.systemPrompt).toBe(PHASE_PROMPTS.plan);
    });
  });

  describe("createBuildAgent", () => {
    it("should create build agent with builder id", () => {
      const agent = createBuildAgent();

      expect(agent.id).toBe("builder");
      expect(agent.type).toBe("build");
    });

    it("should use build model and prompts", () => {
      const agent = createBuildAgent();

      expect(agent.model).toBe(PHASE_MODELS.build);
      expect(agent.systemPrompt).toBe(PHASE_PROMPTS.build);
    });
  });
});
