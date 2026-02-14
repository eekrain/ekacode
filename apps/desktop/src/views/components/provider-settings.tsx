import type {
  ProviderAuthMethodDescriptor,
  ProviderAuthState,
  ProviderClient,
  ProviderDescriptor,
} from "@/core/services/api/provider-client";
import { For, Show, createEffect, createMemo, createResource, createSignal } from "solid-js";

interface ProviderSettingsProps {
  client: ProviderClient;
}

export function ProviderSettings(props: ProviderSettingsProps) {
  const [tokenByProvider, setTokenByProvider] = createSignal<Record<string, string>>({});
  const [oauthCodeByProvider, setOauthCodeByProvider] = createSignal<Record<string, string>>({});
  const [oauthPendingByProvider, setOauthPendingByProvider] = createSignal<
    Record<string, { methodIndex: number; authorizationId: string }>
  >({});
  const [oauthBusyByProvider, setOauthBusyByProvider] = createSignal<Record<string, boolean>>({});
  const [oauthErrorByProvider, setOauthErrorByProvider] = createSignal<Record<string, string>>({});
  const [oauthRunByProvider, setOauthRunByProvider] = createSignal<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [selectedProviderId, setSelectedProviderId] = createSignal<string | null>(null);

  const loadProviderState = async () => {
    const [providers, authMethods, auth] = await Promise.all([
      props.client.listProviders(),
      props.client.listAuthMethods(),
      props.client.listAuthStates(),
    ]);
    return { providers, authMethods, auth };
  };

  const [providerState, { refetch: refetchProviderState }] = createResource(loadProviderState);

  createEffect(() => {
    const providers = providerState()?.providers;
    if (selectedProviderId() || !providers || providers.length === 0) return;
    setSelectedProviderId(providers[0]?.id ?? null);
  });

  const providers = createMemo<ProviderDescriptor[]>(() => providerState()?.providers ?? []);
  const authMethods = createMemo<Record<string, ProviderAuthMethodDescriptor[]>>(
    () => providerState()?.authMethods ?? {}
  );
  const auth = createMemo<Record<string, ProviderAuthState>>(() => providerState()?.auth ?? {});

  const connectedProviders = createMemo(() =>
    providers().filter(provider => auth()[provider.id]?.status === "connected")
  );

  const selectedProvider = createMemo(() => {
    const id = selectedProviderId();
    if (!id) return null;
    return providers().find(provider => provider.id === id) ?? null;
  });

  const methodsForSelected = createMemo(() => {
    const id = selectedProviderId();
    if (!id) return [];
    return authMethods()[id] || [];
  });

  const setTokenDraft = (providerId: string, token: string) => {
    setTokenByProvider(prev => ({ ...prev, [providerId]: token }));
  };

  const setOauthCodeDraft = (providerId: string, code: string) => {
    setOauthCodeByProvider(prev => ({ ...prev, [providerId]: code }));
  };

  const openExternal = async (url: string) => {
    if (window.ekacodeAPI?.shell?.openExternal) {
      await window.ekacodeAPI.shell.openExternal(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const connectToken = async (providerId: string) => {
    const token = tokenByProvider()[providerId]?.trim();
    if (!token) return;

    await props.client.setToken(providerId, token);
    setTokenDraft(providerId, "");
    await refetchProviderState();
  };

  const connectOAuth = async (providerId: string, methodIndex: number) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setOauthRunByProvider(prev => ({ ...prev, [providerId]: runId }));
    setOauthBusyByProvider(prev => ({ ...prev, [providerId]: true }));
    setOauthErrorByProvider(prev => ({ ...prev, [providerId]: "" }));

    try {
      const authorization = await props.client.oauthAuthorize(providerId, methodIndex);
      await openExternal(authorization.url);

      if (authorization.method === "auto") {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          if (oauthRunByProvider()[providerId] !== runId) {
            setOauthBusyByProvider(prev => ({ ...prev, [providerId]: false }));
            return;
          }
          const callback = await props.client.oauthCallback(
            providerId,
            methodIndex,
            authorization.authorizationId
          );
          if (callback.status === "connected") {
            setOauthBusyByProvider(prev => ({ ...prev, [providerId]: false }));
            await refetchProviderState();
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 750));
        }
        setOauthErrorByProvider(prev => ({
          ...prev,
          [providerId]: "Authorization is still pending. Retry or continue waiting.",
        }));
        return;
      }

      setOauthPendingByProvider(prev => ({
        ...prev,
        [providerId]: { methodIndex, authorizationId: authorization.authorizationId },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOauthErrorByProvider(prev => ({ ...prev, [providerId]: message }));
    } finally {
      setOauthBusyByProvider(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const submitOAuthCode = async (providerId: string) => {
    const pending = oauthPendingByProvider()[providerId];
    const code = oauthCodeByProvider()[providerId]?.trim();
    if (!pending || !code) return;

    const callback = await props.client.oauthCallback(
      providerId,
      pending.methodIndex,
      pending.authorizationId,
      code
    );

    if (callback.status === "connected") {
      setOauthPendingByProvider(prev => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
      setOauthCodeByProvider(prev => ({ ...prev, [providerId]: "" }));
      await refetchProviderState();
    }
  };

  const cancelOAuth = (providerId: string) => {
    setOauthRunByProvider(prev => ({ ...prev, [providerId]: `${Date.now()}-cancelled` }));
    setOauthBusyByProvider(prev => ({ ...prev, [providerId]: false }));
  };

  const disconnect = async (providerId: string) => {
    await props.client.clearToken(providerId);
    await refetchProviderState();
  };

  return (
    <section class="mb-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-foreground text-lg font-medium">Providers</h2>
        <button
          class="bg-primary text-primary-foreground rounded px-3 py-1.5 text-xs"
          onClick={() => setIsModalOpen(true)}
        >
          Connect a provider
        </button>
      </div>

      <div class="bg-card border-border rounded-lg border p-4">
        <Show when={!providerState.loading} fallback={<p class="text-sm">Loading providers...</p>}>
          <Show
            when={connectedProviders().length > 0}
            fallback={
              <div class="text-center">
                <p class="text-muted-foreground text-sm">No provider connected yet.</p>
                <button
                  class="bg-primary text-primary-foreground mt-3 rounded px-3 py-1.5 text-xs"
                  onClick={() => setIsModalOpen(true)}
                >
                  Select provider
                </button>
              </div>
            }
          >
            <div class="space-y-3">
              <For each={connectedProviders()}>
                {provider => (
                  <div
                    class="border-border rounded border p-3"
                    data-testid={`provider-${provider.id}`}
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-sm font-medium">{provider.name}</p>
                        <p class="text-muted-foreground text-xs">{provider.id}</p>
                      </div>
                      <span class="text-xs font-medium text-green-600 dark:text-green-400">
                        Connected
                      </span>
                    </div>
                    <div class="mt-2 flex items-center gap-2">
                      <button
                        class="border-border rounded border px-2 py-1 text-xs"
                        onClick={() => {
                          setSelectedProviderId(provider.id);
                          setIsModalOpen(true);
                        }}
                      >
                        Manage
                      </button>
                      <button
                        class="border-border rounded border px-2 py-1 text-xs"
                        onClick={() => void disconnect(provider.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      <Show when={isModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            class="bg-card border-border w-full max-w-3xl rounded-lg border p-4"
            data-testid="provider-modal"
          >
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-foreground text-base font-medium">Connect a provider</h3>
              <button
                class="border-border rounded border px-2 py-1 text-xs"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div class="grid gap-4 md:grid-cols-[1.2fr_2fr]">
              <div class="border-border rounded border p-2">
                <div class="space-y-1">
                  <For each={providers()}>
                    {provider => {
                      const isSelected = () => selectedProviderId() === provider.id;
                      const status = () => auth()[provider.id]?.status;
                      return (
                        <button
                          class={`w-full rounded px-2 py-2 text-left text-sm ${isSelected() ? "bg-muted" : ""}`}
                          onClick={() => setSelectedProviderId(provider.id)}
                        >
                          <div class="flex items-center justify-between">
                            <span>{provider.name}</span>
                            <span class="text-muted-foreground text-[11px]">
                              {status() === "connected" ? "Connected" : "Not connected"}
                            </span>
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>

              <div class="border-border rounded border p-3">
                <Show
                  when={selectedProvider()}
                  fallback={<p class="text-sm">Select a provider.</p>}
                >
                  {provider => {
                    const providerId = provider().id;
                    const pending = () => oauthPendingByProvider()[providerId];
                    const busy = () => oauthBusyByProvider()[providerId] === true;
                    const oauthError = () => oauthErrorByProvider()[providerId];

                    return (
                      <div class="space-y-3">
                        <div>
                          <p class="text-sm font-medium">{provider().name}</p>
                          <p class="text-muted-foreground text-xs">{provider().id}</p>
                        </div>

                        <For each={methodsForSelected()}>
                          {(method, index) => (
                            <div class="border-border rounded border p-2">
                              <p class="mb-2 text-xs font-medium">{method.label}</p>

                              <Show when={method.type === "token"}>
                                <div class="flex flex-wrap items-center gap-2">
                                  <input
                                    type="password"
                                    class="bg-background border-border rounded border px-2 py-1 text-xs"
                                    placeholder="API token"
                                    value={tokenByProvider()[providerId] || ""}
                                    onInput={event =>
                                      setTokenDraft(providerId, event.currentTarget.value)
                                    }
                                  />
                                  <button
                                    class="bg-primary text-primary-foreground rounded px-2 py-1 text-xs"
                                    onClick={() => void connectToken(providerId)}
                                  >
                                    Connect
                                  </button>
                                </div>
                              </Show>

                              <Show when={method.type === "oauth"}>
                                <div class="flex flex-wrap items-center gap-2">
                                  <button
                                    class="border-border rounded border px-2 py-1 text-xs"
                                    disabled={busy()}
                                    onClick={() => void connectOAuth(providerId, index())}
                                  >
                                    {method.label}
                                  </button>
                                  <Show when={busy()}>
                                    <button
                                      class="border-border rounded border px-2 py-1 text-xs"
                                      onClick={() => cancelOAuth(providerId)}
                                    >
                                      Cancel OAuth
                                    </button>
                                  </Show>
                                </div>
                              </Show>
                            </div>
                          )}
                        </For>

                        <Show when={pending()}>
                          <div class="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              class="bg-background border-border rounded border px-2 py-1 text-xs"
                              placeholder="Paste OAuth code"
                              value={oauthCodeByProvider()[providerId] || ""}
                              onInput={event =>
                                setOauthCodeDraft(providerId, event.currentTarget.value)
                              }
                            />
                            <button
                              class="bg-primary text-primary-foreground rounded px-2 py-1 text-xs"
                              onClick={() => void submitOAuthCode(providerId)}
                            >
                              Submit Code
                            </button>
                          </div>
                        </Show>

                        <Show when={oauthError()}>
                          <p class="text-xs text-red-600 dark:text-red-400">{oauthError()}</p>
                        </Show>
                      </div>
                    );
                  }}
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </section>
  );
}
