import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProviderAuthService } from "../../src/provider/auth/service";
import { createProviderCredentialStorage } from "../../src/provider/storage";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map(path => rm(path, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("provider auth service", () => {
  it("stores token and returns connected auth state", async () => {
    const base = await mkdtemp(join(tmpdir(), "ekacode-provider-auth-"));
    tempDirs.push(base);

    const auth = createProviderAuthService({
      storage: createProviderCredentialStorage({ baseDir: base }),
      profileId: "default",
    });

    await auth.setToken({ providerId: "zai", token: "token-123" });

    const state = await auth.getState("zai");

    expect(state.status).toBe("connected");
    expect(state.method).toBe("token");
    expect(state.providerId).toBe("zai");
  });

  it("clears token and returns disconnected auth state", async () => {
    const base = await mkdtemp(join(tmpdir(), "ekacode-provider-auth-"));
    tempDirs.push(base);

    const auth = createProviderAuthService({
      storage: createProviderCredentialStorage({ baseDir: base }),
      profileId: "default",
    });

    await auth.setToken({ providerId: "zai", token: "token-123" });
    await auth.clear("zai");

    const state = await auth.getState("zai");

    expect(state.status).toBe("disconnected");
  });

  it("does not expose secret in auth state payload", async () => {
    const base = await mkdtemp(join(tmpdir(), "ekacode-provider-auth-"));
    tempDirs.push(base);

    const auth = createProviderAuthService({
      storage: createProviderCredentialStorage({ baseDir: base }),
      profileId: "default",
    });

    await auth.setToken({ providerId: "zai", token: "super-secret-token" });

    const state = await auth.getState("zai");

    expect((state as unknown as { secret?: string }).secret).toBeUndefined();
  });
});
