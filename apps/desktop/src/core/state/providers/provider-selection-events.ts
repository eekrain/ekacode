export const PROVIDER_SELECTION_REFRESH_EVENT = "sakti-code:providers.refresh";

interface ProviderSelectionRefreshDetail {
  reason: string;
  updatedAt: string;
}

export function notifyProviderSelectionRefresh(reason: string) {
  if (typeof window === "undefined") return;
  const detail: ProviderSelectionRefreshDetail = {
    reason,
    updatedAt: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent(PROVIDER_SELECTION_REFRESH_EVENT, { detail }));
}
