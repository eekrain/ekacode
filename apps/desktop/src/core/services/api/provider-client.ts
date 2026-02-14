export interface ProviderDescriptor {
  id: string;
  name: string;
  env?: string[];
  api?: boolean;
  models?: boolean;
  auth?: {
    kind: "token" | "oauth" | "none";
  };
}

export interface ProviderAuthState {
  providerId: string;
  status: "connected" | "disconnected" | "error" | "oauth_required";
  method: "token" | "oauth" | "none";
  accountLabel: string | null;
  updatedAt: string;
}

export interface ProviderModel {
  id: string;
  providerId: string;
  name?: string;
  capabilities?: {
    text: boolean;
    vision: boolean;
    tools: boolean;
    reasoning: boolean;
    plan: boolean;
  };
}

export interface ProviderClient {
  listProviders(): Promise<ProviderDescriptor[]>;
  listAuthStates(): Promise<Record<string, ProviderAuthState>>;
  listModels(): Promise<ProviderModel[]>;
  setToken(providerId: string, token: string): Promise<void>;
  clearToken(providerId: string): Promise<void>;
}

export interface CreateProviderClientOptions {
  fetcher: (path: string, init?: RequestInit) => Promise<Response>;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function createProviderClient(options: CreateProviderClientOptions): ProviderClient {
  return {
    async listProviders() {
      const response = await options.fetcher("/api/providers", { method: "GET" });
      const data = await parseJsonOrThrow<{ providers: ProviderDescriptor[] }>(response);
      return data.providers ?? [];
    },

    async listAuthStates() {
      const response = await options.fetcher("/api/providers/auth", { method: "GET" });
      return parseJsonOrThrow<Record<string, ProviderAuthState>>(response);
    },

    async listModels() {
      const response = await options.fetcher("/api/providers/models", { method: "GET" });
      const data = await parseJsonOrThrow<{ models: ProviderModel[] }>(response);
      return data.models ?? [];
    },

    async setToken(providerId, token) {
      const response = await options.fetcher(`/api/providers/${providerId}/auth/token`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      await parseJsonOrThrow(response);
    },

    async clearToken(providerId) {
      const response = await options.fetcher(`/api/providers/${providerId}/auth/token`, {
        method: "DELETE",
      });

      await parseJsonOrThrow(response);
    },
  };
}
