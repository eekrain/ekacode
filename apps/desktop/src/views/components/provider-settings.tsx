import type {
  ProviderAuthState,
  ProviderClient,
  ProviderDescriptor,
  ProviderModel,
} from "@/core/services/api/provider-client";
import { For, Show, createSignal, onMount } from "solid-js";
import { ModelSelector } from "./model-selector";

interface ProviderSettingsProps {
  client: ProviderClient;
}

export function ProviderSettings(props: ProviderSettingsProps) {
  const [providers, setProviders] = createSignal<ProviderDescriptor[]>([]);
  const [auth, setAuth] = createSignal<Record<string, ProviderAuthState>>({});
  const [models, setModels] = createSignal<ProviderModel[]>([]);
  const [tokenByProvider, setTokenByProvider] = createSignal<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = createSignal<string>("");
  const [isLoading, setIsLoading] = createSignal(true);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const [providerData, authData, modelData] = await Promise.all([
        props.client.listProviders(),
        props.client.listAuthStates(),
        props.client.listModels(),
      ]);
      setProviders(providerData);
      setAuth(authData);
      setModels(modelData);
      if (!selectedModel() && modelData.length > 0) {
        setSelectedModel(modelData[0]!.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    void refresh();
  });

  const setTokenDraft = (providerId: string, token: string) => {
    setTokenByProvider(prev => ({ ...prev, [providerId]: token }));
  };

  const connectToken = async (providerId: string) => {
    const token = tokenByProvider()[providerId]?.trim();
    if (!token) return;

    await props.client.setToken(providerId, token);
    setTokenDraft(providerId, "");
    await refresh();
  };

  const disconnect = async (providerId: string) => {
    await props.client.clearToken(providerId);
    await refresh();
  };

  return (
    <section class="mb-8">
      <h2 class="text-foreground mb-4 text-lg font-medium">Providers</h2>
      <div class="bg-card border-border rounded-lg border p-4">
        <Show when={!isLoading()} fallback={<p class="text-sm">Loading providers...</p>}>
          <div class="space-y-4">
            <For each={providers()}>
              {provider => {
                const state = () => auth()[provider.id];
                const connected = () => state()?.status === "connected";

                return (
                  <div
                    class="border-border rounded border p-3"
                    data-testid={`provider-${provider.id}`}
                  >
                    <div class="mb-2 flex items-center justify-between">
                      <div>
                        <p class="text-sm font-medium">{provider.name}</p>
                        <p class="text-muted-foreground text-xs">{provider.id}</p>
                      </div>
                      <span class="text-xs" data-testid={`provider-status-${provider.id}`}>
                        {connected() ? "Connected" : "Disconnected"}
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        type="password"
                        class="bg-background border-border rounded border px-2 py-1 text-xs"
                        placeholder="API token"
                        value={tokenByProvider()[provider.id] || ""}
                        onInput={event => setTokenDraft(provider.id, event.currentTarget.value)}
                      />
                      <button
                        class="bg-primary text-primary-foreground rounded px-2 py-1 text-xs"
                        onClick={() => connectToken(provider.id)}
                      >
                        Connect
                      </button>
                      <button
                        class="border-border rounded border px-2 py-1 text-xs"
                        onClick={() => disconnect(provider.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>

            <Show when={models().length > 0}>
              <ModelSelector
                models={models()}
                selectedModelId={selectedModel()}
                onChange={setSelectedModel}
              />
            </Show>
          </div>
        </Show>
      </div>
    </section>
  );
}
