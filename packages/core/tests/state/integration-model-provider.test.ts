/**
 * Tests for model provider configuration
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildModel,
  exploreModel,
  exploreModelOpenAI,
  getBuildModel,
  getExploreModel,
  getPlanModel,
  planModel,
  planModelOpenAI,
} from "../../src/state/integration/model-provider";

describe("state/integration/model-provider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Z.ai models (primary)", () => {
    describe("planModel", () => {
      it("should be defined", () => {
        expect(planModel).toBeDefined();
      });

      it("should have model ID glm-4.7", () => {
        expect(planModel).toHaveProperty("modelId", "glm-4.7");
      });

      it("should have specification version v3", () => {
        expect(planModel).toHaveProperty("specificationVersion", "v3");
      });

      it("should have provider zai.chat", () => {
        expect(planModel).toHaveProperty("provider", "zai.chat");
      });
    });

    describe("buildModel", () => {
      it("should be defined", () => {
        expect(buildModel).toBeDefined();
      });

      it("should have model ID glm-4.7-flash", () => {
        expect(buildModel).toHaveProperty("modelId", "glm-4.7-flash");
      });

      it("should have specification version v3", () => {
        expect(buildModel).toHaveProperty("specificationVersion", "v3");
      });

      it("should have provider zai.chat", () => {
        expect(buildModel).toHaveProperty("provider", "zai.chat");
      });
    });

    describe("exploreModel", () => {
      it("should be defined", () => {
        expect(exploreModel).toBeDefined();
      });

      it("should have model ID glm-4.7-flashx", () => {
        expect(exploreModel).toHaveProperty("modelId", "glm-4.7-flashx");
      });

      it("should have specification version v3", () => {
        expect(exploreModel).toHaveProperty("specificationVersion", "v3");
      });

      it("should have provider zai.chat", () => {
        expect(exploreModel).toHaveProperty("provider", "zai.chat");
      });
    });
  });

  describe("OpenAI models (fallback)", () => {
    describe("planModelOpenAI", () => {
      it("should be defined", () => {
        expect(planModelOpenAI).toBeDefined();
      });

      it("should have model ID gpt-4o", () => {
        expect(planModelOpenAI).toHaveProperty("modelId", "gpt-4o");
      });

      it("should have provider openai", () => {
        expect(planModelOpenAI).toHaveProperty("provider");
        expect(planModelOpenAI.provider).toContain("openai");
      });
    });

    describe("exploreModelOpenAI", () => {
      it("should be defined", () => {
        expect(exploreModelOpenAI).toBeDefined();
      });

      it("should have model ID gpt-4o-mini", () => {
        expect(exploreModelOpenAI).toHaveProperty("modelId", "gpt-4o-mini");
      });

      it("should have provider openai", () => {
        expect(exploreModelOpenAI).toHaveProperty("provider");
        expect(exploreModelOpenAI.provider).toContain("openai");
      });
    });
  });

  describe("Model selection helpers", () => {
    describe("getPlanModel", () => {
      it("should return Z.ai model when ZAI_API_KEY is set", () => {
        process.env.ZAI_API_KEY = "test-key";
        const model = getPlanModel();
        expect(model).toHaveProperty("modelId", "glm-4.7");
      });

      it("should return Z.ai model when ZAI_BASE_URL is set", () => {
        process.env.ZAI_BASE_URL = "https://api.z.ai";
        const model = getPlanModel();
        expect(model).toHaveProperty("modelId", "glm-4.7");
      });

      it("should return OpenAI model when only OPENAI_API_KEY is set", () => {
        delete process.env.ZAI_API_KEY;
        delete process.env.ZAI_BASE_URL;
        process.env.OPENAI_API_KEY = "test-key";
        const model = getPlanModel();
        expect(model).toHaveProperty("modelId", "gpt-4o");
      });

      it("should throw error when no API keys are set", () => {
        delete process.env.ZAI_API_KEY;
        delete process.env.ZAI_BASE_URL;
        delete process.env.OPENAI_API_KEY;
        expect(() => getPlanModel()).toThrow("No model provider available");
      });

      it("should prioritize Z.ai over OpenAI when both are set", () => {
        process.env.ZAI_API_KEY = "zai-key";
        process.env.OPENAI_API_KEY = "openai-key";
        const model = getPlanModel();
        expect(model).toHaveProperty("modelId", "glm-4.7");
      });
    });

    describe("getBuildModel", () => {
      it("should return Z.ai model when ZAI_API_KEY is set", () => {
        process.env.ZAI_API_KEY = "test-key";
        const model = getBuildModel();
        expect(model).toHaveProperty("modelId", "glm-4.7-flash");
      });

      it("should return Z.ai model when ZAI_BASE_URL is set", () => {
        process.env.ZAI_BASE_URL = "https://api.z.ai";
        const model = getBuildModel();
        expect(model).toHaveProperty("modelId", "glm-4.7-flash");
      });

      it("should throw error when ZAI_API_KEY is not set", () => {
        delete process.env.ZAI_API_KEY;
        delete process.env.ZAI_BASE_URL;
        expect(() => getBuildModel()).toThrow("Build model requires Z.ai provider");
      });
    });

    describe("getExploreModel", () => {
      it("should return Z.ai model when ZAI_API_KEY is set", () => {
        process.env.ZAI_API_KEY = "test-key";
        const model = getExploreModel();
        expect(model).toHaveProperty("modelId", "glm-4.7-flashx");
      });

      it("should return OpenAI model when only OPENAI_API_KEY is set", () => {
        delete process.env.ZAI_API_KEY;
        delete process.env.ZAI_BASE_URL;
        process.env.OPENAI_API_KEY = "test-key";
        const model = getExploreModel();
        expect(model).toHaveProperty("modelId", "gpt-4o-mini");
      });

      it("should throw error when no API keys are set", () => {
        delete process.env.ZAI_API_KEY;
        delete process.env.ZAI_BASE_URL;
        delete process.env.OPENAI_API_KEY;
        expect(() => getExploreModel()).toThrow("No model provider available");
      });

      it("should prioritize Z.ai over OpenAI when both are set", () => {
        process.env.ZAI_API_KEY = "zai-key";
        process.env.OPENAI_API_KEY = "openai-key";
        const model = getExploreModel();
        expect(model).toHaveProperty("modelId", "glm-4.7-flashx");
      });
    });
  });
});
