import type { ProviderCredentialStorage } from "../storage";
import type { ProviderAuthState } from "../types";

export interface SetProviderTokenInput {
  providerId: string;
  token: string;
}

export interface ProviderAuthServiceOptions {
  storage: ProviderCredentialStorage;
  profileId: string;
}

export interface ProviderAuthService {
  setToken(input: SetProviderTokenInput): Promise<void>;
  clear(providerId: string): Promise<void>;
  getState(providerId: string): Promise<ProviderAuthState>;
}

export function createProviderAuthService(
  options: ProviderAuthServiceOptions
): ProviderAuthService {
  return {
    async setToken(input) {
      await options.storage.set({
        providerId: input.providerId,
        profileId: options.profileId,
        kind: "token",
        secret: input.token,
        updatedAt: new Date().toISOString(),
      });
    },

    async clear(providerId) {
      await options.storage.remove({
        providerId,
        profileId: options.profileId,
      });
    },

    async getState(providerId) {
      const record = await options.storage.get({
        providerId,
        profileId: options.profileId,
      });

      return {
        providerId,
        status: record ? "connected" : "disconnected",
        method: record?.kind ?? "token",
        accountLabel: null,
        updatedAt: record?.updatedAt ?? new Date().toISOString(),
      };
    },
  };
}
