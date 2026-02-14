import { createProviderClient } from "@/core/services/api/provider-client";
import { describe, expect, it, vi } from "vitest";

describe("provider client", () => {
  it("lists providers", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ providers: [{ id: "zai", name: "Z.AI" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const client = createProviderClient({
      fetcher,
    });

    const providers = await client.listProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe("zai");
    expect(fetcher).toHaveBeenCalledWith("/api/providers", { method: "GET" });
  });

  it("lists models", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ models: [{ id: "zai/glm-4.7", providerId: "zai" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const client = createProviderClient({ fetcher });
    const models = await client.listModels();

    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe("zai/glm-4.7");
    expect(fetcher).toHaveBeenCalledWith("/api/providers/models", { method: "GET" });
  });

  it("sets and clears provider token", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const client = createProviderClient({ fetcher });

    await client.setToken("zai", "token-123");
    await client.clearToken("zai");

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/providers/zai/auth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
      })
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/api/providers/zai/auth/token",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
