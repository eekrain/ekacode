import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const policyModulePath = pathToFileURL(
  path.resolve(thisDir, "../../../../scripts/check-server-migration-policy.mjs")
).href;

describe("migration policy checker", () => {
  it("allows append-only migration changes", async () => {
    const { evaluateMigrationDiff } = await import(policyModulePath);
    const result = evaluateMigrationDiff([
      "A\tpackages/server/drizzle/0004_new_feature.sql",
      "A\tpackages/server/drizzle/meta/0004_snapshot.json",
      "M\tpackages/server/drizzle/meta/_journal.json",
    ]);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects deleting migration SQL files in strict mode", async () => {
    const { evaluateMigrationDiff } = await import(policyModulePath);
    const result = evaluateMigrationDiff(["D\tpackages/server/drizzle/0001_bent_leper_queen.sql"]);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/Disallowed migration change/);
  });

  it("rejects renaming migration SQL files in strict mode", async () => {
    const { evaluateMigrationDiff } = await import(policyModulePath);
    const result = evaluateMigrationDiff([
      "R100\tpackages/server/drizzle/0001_bent_leper_queen.sql\tpackages/server/drizzle/0001_renamed.sql",
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/Disallowed migration change/);
  });

  it("rejects modifying existing snapshot files in strict mode", async () => {
    const { evaluateMigrationDiff } = await import(policyModulePath);
    const result = evaluateMigrationDiff(["M\tpackages/server/drizzle/meta/0002_snapshot.json"]);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/Disallowed migration change/);
  });
});

describe("migration policy checker with squash mode", () => {
  const originalEnv = process.env.SAKTI_ALLOW_MIGRATION_SQUASH;

  beforeEach(() => {
    process.env.SAKTI_ALLOW_MIGRATION_SQUASH = "1";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SAKTI_ALLOW_MIGRATION_SQUASH;
    } else {
      process.env.SAKTI_ALLOW_MIGRATION_SQUASH = originalEnv;
    }
  });

  it("allows deleting migration SQL files in squash mode", async () => {
    const { evaluateMigrationDiff } = await import(policyModulePath);
    const result = evaluateMigrationDiff(["D\tpackages/server/drizzle/0001_bent_leper_queen.sql"]);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("allows renaming migration SQL files in squash mode", async () => {
    const { evaluateMigrationDiff } = await import(policyModulePath);
    const result = evaluateMigrationDiff([
      "R100\tpackages/server/drizzle/0001_bent_leper_queen.sql\tpackages/server/drizzle/0001_renamed.sql",
    ]);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("allows modifying existing snapshot files in squash mode", async () => {
    const { evaluateMigrationDiff } = await import(policyModulePath);
    const result = evaluateMigrationDiff(["M\tpackages/server/drizzle/meta/0002_snapshot.json"]);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
