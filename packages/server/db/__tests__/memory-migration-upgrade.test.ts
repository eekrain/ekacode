/**
 * Migration tests for memory schema.
 *
 * Verifies the baseline migration correctly creates FTS tables,
 * triggers for auto-sync, and search functionality works.
 */

import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("memory migration", () => {
  const cleanupDirs: string[] = [];

  afterAll(async () => {
    for (const dir of cleanupDirs) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("creates FTS tables and maintains triggers in baseline migration", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "sakti-code-migrate-"));
    cleanupDirs.push(tempRoot);

    const fullMigrations = path.resolve(__dirname, "../../drizzle");
    const client = createClient({ url: `file:${path.join(tempRoot, "test.db")}` });
    const db = drizzle(client);

    await migrate(db, { migrationsFolder: fullMigrations });

    const hasFts = await db.all(sql`
      SELECT name FROM sqlite_master WHERE type='table' AND name = 'messages_fts'
    `);
    expect(hasFts.length).toBe(1);

    const hasTriggers = await db.all(sql`
      SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'messages_fts_%'
    `);
    expect(hasTriggers.length).toBe(3);

    const now = Date.now();
    await db.run(sql`
      INSERT INTO threads (id, resource_id, title, created_at, updated_at)
      VALUES ('test-thread', 'test-resource', 'Test', ${now}, ${now})
    `);
    await db.run(sql`
      INSERT INTO messages (id, thread_id, resource_id, role, raw_content, search_text, injection_text, created_at, message_index)
      VALUES ('test-msg', 'test-thread', 'test-resource', 'assistant', 'raw', 'testsearch', 'inj', ${now}, 0)
    `);

    const searchResult = await db.all(sql`
      SELECT rowid FROM messages_fts WHERE messages_fts MATCH 'testsearch'
    `);
    expect(searchResult.length).toBe(1);

    client.close();
  });
});
