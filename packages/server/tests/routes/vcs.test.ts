/**
 * Tests for VCS route
 *
 * Tests the GET /api/vcs endpoint
 */

import { describe, expect, it } from "vitest";

describe("GET /api/vcs", () => {
  it("returns VCS info for a git repository", async () => {
    const vcsRouter = (await import("../../src/routes/vcs")).default;

    const response = await vcsRouter.request(
      "http://localhost/api/vcs?directory=/home/eekrain/CODE/ekacode",
      { method: "GET" }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("directory");
    expect(body).toHaveProperty("type");
  });

  it("returns type 'none' for non-git directory", async () => {
    const vcsRouter = (await import("../../src/routes/vcs")).default;

    const response = await vcsRouter.request("http://localhost/api/vcs?directory=/tmp", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("none");
    expect(body.status).toBe("uninitialized");
  });

  it("returns 400 for empty directory", async () => {
    const vcsRouter = (await import("../../src/routes/vcs")).default;

    const response = await vcsRouter.request("http://localhost/api/vcs?directory=", {
      method: "GET",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("includes branch and commit for git repo", async () => {
    const vcsRouter = (await import("../../src/routes/vcs")).default;

    const response = await vcsRouter.request(
      "http://localhost/api/vcs?directory=/home/eekrain/CODE/ekacode",
      { method: "GET" }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    if (body.type === "git") {
      expect(body).toHaveProperty("branch");
      expect(body).toHaveProperty("commit");
    }
  });
});
