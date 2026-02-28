import { v7 as uuidv7 } from "uuid";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, projects, taskSessions, threads, workspaces } from "../../db";

vi.mock("uuid", () => ({
  v7: vi.fn(),
}));

const uuidv7Mock = vi.mocked(uuidv7) as unknown as ReturnType<typeof vi.fn>;

describe("projects", () => {
  beforeAll(async () => {
    const { setupTestDatabase } = await import("../../db/test-setup");
    await setupTestDatabase();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    let counter = 0;
    uuidv7Mock.mockImplementation(() => {
      counter++;
      return `project-id-${counter}`;
    });
    await db.delete(taskSessions);
    await db.delete(threads);
    await db.delete(workspaces);
    await db.delete(projects);
  });

  afterEach(async () => {
    await db.delete(taskSessions);
    await db.delete(threads);
    await db.delete(workspaces);
    await db.delete(projects);
  });

  it("returns existing project for duplicate path", async () => {
    const { getOrCreateProject } = await import("../../db/projects");

    const first = await getOrCreateProject({
      name: "acme/app",
      path: "github.com/acme/app",
    });
    const second = await getOrCreateProject({
      name: "acme/app",
      path: "github.com/acme/app",
    });

    expect(first.id).toBe(second.id);
    expect(first.path).toBe(second.path);
  });
});
