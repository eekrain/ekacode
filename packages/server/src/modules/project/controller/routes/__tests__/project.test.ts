/**
 * Tests for project route
 *
 * Tests the GET /api/project and GET /api/projects endpoints
 */

import { describe, expect, it } from "vitest";

describe("project routes", () => {
  describe("GET /api/project", () => {
    it("returns project info for directory", async () => {
      const projectRouter = (await import("../project.route")).projectApp;

      const response = await projectRouter.request(
        "http://localhost/api/project?directory=/home/eekrain/CODE/sakti-code",
        { method: "GET" }
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.detectedBy).toBe("directory");
      expect(typeof body.name).toBe("string");
      expect(body.name.length).toBeGreaterThan(0);
      expect(typeof body.path).toBe("string");
    });

    it("returns 400 for empty directory", async () => {
      const projectRouter = (await import("../project.route")).projectApp;

      const response = await projectRouter.request("http://localhost/api/project?directory=", {
        method: "GET",
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty("error");
    });
  });

  describe("GET /api/projects", () => {
    it("returns list of projects from database", async () => {
      const projectRouter = (await import("../project.route")).projectApp;

      const response = await projectRouter.request("http://localhost/api/projects", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("projects");
      expect(Array.isArray(body.projects)).toBe(true);
    });
  });
});
