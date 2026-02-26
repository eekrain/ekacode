import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../../index.js";
import {
  completeOAuth,
  listProviderAuthMethods,
  startOAuth,
} from "../../../../provider/auth/oauth.js";
import { listProviderDescriptors } from "../../../../provider/registry.js";
import { getProviderRuntime } from "../../../../provider/runtime.js";
import {
  buildProviderCatalog,
  collectKnownProviderIds,
} from "../../application/usecases/list-provider-catalog.usecase.js";
import { normalizeProviderError } from "../../domain/errors/provider.error.js";
import {
  providerAuthStateSchema,
  providerCatalogItemSchema,
  providerDescriptorSchema,
  providerOAuthAuthorizeRequestSchema,
  providerOAuthCallbackRequestSchema,
  providerPreferencesUpdateSchema,
} from "../schemas/provider.schema.js";

const providerRoutes = new Hono<Env>();

const setTokenBodySchema = z.object({
  token: z.string().min(1),
});

const providerRuntime = getProviderRuntime();

async function providerExists(providerId: string): Promise<boolean> {
  const providers = listProviderDescriptors();
  if (providers.some(provider => provider.id === providerId)) return true;

  const models = await providerRuntime.modelCatalogService.list();
  return models.some(model => model.providerId === providerId);
}

async function listKnownProviderDescriptors() {
  const descriptors = listProviderDescriptors();
  const byId = new Map(descriptors.map(provider => [provider.id, provider] as const));
  const models = await providerRuntime.modelCatalogService.list();

  for (const model of models) {
    if (byId.has(model.providerId)) continue;
    byId.set(model.providerId, {
      id: model.providerId,
      name: model.providerName || model.providerId,
      env: model.providerEnvVars ?? [],
      api: true,
      models: true,
      auth: { kind: "token" as const },
    });
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

providerRoutes.get("/api/providers", async c => {
  const providers = (await listKnownProviderDescriptors()).map(provider =>
    providerDescriptorSchema.parse(provider)
  );

  return c.json({
    providers,
  });
});

providerRoutes.get("/api/providers/auth", async c => {
  const providers = listProviderDescriptors();
  const models = await providerRuntime.modelCatalogService.list();
  const providerIds = Array.from(collectKnownProviderIds({ providers, models }));
  const authStates = await Promise.all(
    providerIds.map(async providerId => {
      const state = await providerRuntime.authService.getState(providerId);
      return [providerId, providerAuthStateSchema.parse(state)] as const;
    })
  );

  return c.json(Object.fromEntries(authStates));
});

providerRoutes.get("/api/providers/catalog", async c => {
  const providers = listProviderDescriptors();
  const models = await providerRuntime.modelCatalogService.list();
  const catalog = await buildProviderCatalog({
    providers,
    models,
    authService: providerRuntime.authService,
  });
  return c.json({
    providers: catalog.map(item => providerCatalogItemSchema.parse(item)),
  });
});

providerRoutes.get("/api/providers/auth/methods", async c => {
  const providers = listProviderDescriptors();
  const models = await providerRuntime.modelCatalogService.list();
  const providerIds = Array.from(collectKnownProviderIds({ providers, models }));
  return c.json(listProviderAuthMethods(providerIds));
});

providerRoutes.get("/api/providers/models", async c => {
  const models = await providerRuntime.modelCatalogService.list();
  return c.json({ models });
});

providerRoutes.get("/api/providers/preferences", async c => {
  const preferences = await providerRuntime.preferenceService.get();
  return c.json(preferences);
});

providerRoutes.put("/api/providers/preferences", async c => {
  const body = providerPreferencesUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    const normalized = normalizeProviderError(new Error("Invalid provider preferences payload"));
    return c.json(normalized, normalized.status);
  }

  const preferences = await providerRuntime.preferenceService.set({
    selectedProviderId: body.data.selectedProviderId,
    selectedModelId: body.data.selectedModelId,
    hybridEnabled: body.data.hybridEnabled,
    hybridVisionProviderId: body.data.hybridVisionProviderId,
    hybridVisionModelId: body.data.hybridVisionModelId,
  });
  return c.json(preferences);
});

providerRoutes.post("/api/providers/:providerId/auth/token", async c => {
  const providerId = c.req.param("providerId");
  const exists = await providerExists(providerId);
  if (!exists) {
    const normalized = normalizeProviderError(new Error("Provider not found"));
    return c.json(normalized, normalized.status);
  }

  const body = setTokenBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    const normalized = normalizeProviderError(new Error("Invalid token payload"));
    return c.json(normalized, normalized.status);
  }

  await providerRuntime.authService.setToken({
    providerId,
    token: body.data.token,
  });

  return c.json({ ok: true });
});

providerRoutes.delete("/api/providers/:providerId/auth/token", async c => {
  const providerId = c.req.param("providerId");
  const exists = await providerExists(providerId);
  if (!exists) {
    const normalized = normalizeProviderError(new Error("Provider not found"));
    return c.json(normalized, normalized.status);
  }

  await providerRuntime.authService.clear(providerId);

  return c.json({ ok: true });
});

providerRoutes.post("/api/providers/:providerId/oauth/authorize", async c => {
  const providerId = c.req.param("providerId");
  const exists = await providerExists(providerId);
  if (!exists) {
    const normalized = normalizeProviderError(new Error("Provider not found"));
    return c.json(normalized, normalized.status);
  }

  const body = providerOAuthAuthorizeRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    const normalized = normalizeProviderError(new Error("Invalid oauth authorize payload"));
    return c.json(normalized, normalized.status);
  }

  try {
    const result = await startOAuth({
      providerId,
      method: body.data.method,
      inputs: body.data.inputs,
    });
    return c.json(result);
  } catch (error) {
    const normalized = normalizeProviderError(error);
    return c.json(normalized, normalized.status);
  }
});

providerRoutes.post("/api/providers/:providerId/oauth/callback", async c => {
  const providerId = c.req.param("providerId");
  const exists = await providerExists(providerId);
  if (!exists) {
    const normalized = normalizeProviderError(new Error("Provider not found"));
    return c.json(normalized, normalized.status);
  }

  const body = providerOAuthCallbackRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    const normalized = normalizeProviderError(new Error("Invalid oauth callback payload"));
    return c.json(normalized, normalized.status);
  }

  try {
    const result = await completeOAuth(
      {
        providerId,
        method: body.data.method,
        authorizationId: body.data.authorizationId,
        code: body.data.code,
      },
      providerRuntime.authService
    );
    return c.json(result);
  } catch (error) {
    const normalized = normalizeProviderError(error);
    return c.json(normalized, normalized.status);
  }
});

export { providerRoutes };
