import { describe, expect, it, vi } from "vitest";
import { Instance } from "../../../src/instance";

const createOpenAIMock = vi.fn(
  (options: { apiKey?: string; baseURL?: string; headers?: Record<string, string> }) =>
    vi.fn((modelId: string) => ({
      provider: "openai",
      modelId,
      options,
    }))
);

const createZaiMock = vi.fn(
  (options: { apiKey?: string; endpoint?: "general" | "coding"; baseURL?: string }) =>
    vi.fn((modelId: string) => ({
      provider: "zai",
      modelId,
      options,
    }))
);

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAIMock,
}));

vi.mock("@ekacode/zai", () => ({
  createZai: createZaiMock,
}));

describe("agent/workflow/model-provider", () => {
  it("uses request-scoped context for non-zai provider selection", async () => {
    const { getBuildModel } = await import("../../../src/agent/workflow/model-provider");

    const model = await Instance.provide({
      directory: process.cwd(),
      async fn() {
        Instance.context.providerRuntime = {
          providerId: "openrouter",
          modelId: "openrouter/deepseek/chat",
          providerApiUrl: "https://openrouter.example/v1",
          apiKey: "context-key",
        };
        return getBuildModel();
      },
    });

    expect(model).toEqual({
      provider: "openai",
      modelId: "deepseek/chat",
      options: {
        apiKey: "context-key",
        baseURL: "https://openrouter.example/v1",
        headers: {
          "HTTP-Referer": "https://opencode.ai/",
          "X-Title": "opencode",
        },
      },
    });
  });

  it("keeps zai-coding-plan on the custom zai sdk path", async () => {
    const { getBuildModel } = await import("../../../src/agent/workflow/model-provider");

    const model = await Instance.provide({
      directory: process.cwd(),
      async fn() {
        Instance.context.providerRuntime = {
          providerId: "zai-coding-plan",
          modelId: "zai-coding-plan/glm-4.7",
          apiKey: "zai-context-key",
        };
        return getBuildModel();
      },
    });

    expect(model).toEqual({
      provider: "zai",
      modelId: "glm-4.7",
      options: {
        apiKey: "zai-context-key",
        endpoint: "coding",
        baseURL: undefined,
      },
    });
  });

  it("prefers context-scoped credentials when resolving model references", async () => {
    const { getModelByReference } = await import("../../../src/agent/workflow/model-provider");

    const model = await Instance.provide({
      directory: process.cwd(),
      async fn() {
        Instance.context.providerRuntime = {
          providerId: "openai",
          modelId: "openai/gpt-4o",
          providerApiUrl: "https://api.context.test/v1",
          apiKey: "context-openai-key",
        };
        return getModelByReference("openai/gpt-4o-mini");
      },
    });

    expect(model).toEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
      options: {
        apiKey: "context-openai-key",
        baseURL: "https://api.context.test/v1",
        headers: {},
      },
    });
  });

  it("isolates provider runtime selection across concurrent async contexts", async () => {
    const { getBuildModel } = await import("../../../src/agent/workflow/model-provider");
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const [a, b] = await Promise.all([
      Instance.provide({
        directory: process.cwd(),
        async fn() {
          Instance.context.providerRuntime = {
            providerId: "openai",
            modelId: "openai/gpt-4o",
            providerApiUrl: "https://a.example/v1",
            apiKey: "key-a",
          };
          await sleep(5);
          return getBuildModel();
        },
      }),
      Instance.provide({
        directory: process.cwd(),
        async fn() {
          Instance.context.providerRuntime = {
            providerId: "openai",
            modelId: "openai/gpt-4o-mini",
            providerApiUrl: "https://b.example/v1",
            apiKey: "key-b",
          };
          await sleep(1);
          return getBuildModel();
        },
      }),
    ]);

    expect(a).toEqual({
      provider: "openai",
      modelId: "gpt-4o",
      options: {
        apiKey: "key-a",
        baseURL: "https://a.example/v1",
        headers: {},
      },
    });
    expect(b).toEqual({
      provider: "openai",
      modelId: "gpt-4o-mini",
      options: {
        apiKey: "key-b",
        baseURL: "https://b.example/v1",
        headers: {},
      },
    });
  });

  it("builds a hybrid model when request context includes hybrid vision runtime", async () => {
    const { getBuildModel } = await import("../../../src/agent/workflow/model-provider");
    const { HybridAgent } = await import("../../../src/agent/hybrid-agent");

    const model = await Instance.provide({
      directory: process.cwd(),
      async fn() {
        Instance.context.providerRuntime = {
          providerId: "openai",
          modelId: "openai/gpt-4o-mini",
          providerApiUrl: "https://openai.example/v1",
          apiKey: "text-key",
          hybridVisionEnabled: true,
          hybridVisionProviderId: "zai",
          hybridVisionModelId: "zai/glm-4.6v",
          hybridVisionApiKey: "vision-key",
        };
        return getBuildModel();
      },
    });

    expect(model).toBeInstanceOf(HybridAgent);
  });
});
