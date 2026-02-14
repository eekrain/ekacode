export interface OAuthStartResult {
  providerId: string;
  state: string;
  url: string;
}

export interface OAuthCompleteResult {
  providerId: string;
  success: boolean;
}

// Placeholder OAuth scaffolding to be expanded per provider.
export function startOAuth(providerId: string): OAuthStartResult {
  return {
    providerId,
    state: randomUUID(),
    url: "about:blank",
  };
}

export function completeOAuth(providerId: string): OAuthCompleteResult {
  return {
    providerId,
    success: true,
  };
}
import { randomUUID } from "node:crypto";
