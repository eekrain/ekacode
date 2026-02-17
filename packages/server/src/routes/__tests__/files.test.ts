import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import filesRouter from "../files";

describe("files router", () => {
  const app = new Hono().route("/", filesRouter);

  it("should search files", async () => {
    const res = await app.request("/api/files/search?directory=/test&query=index");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("files");
    if (Array.isArray(body.files) && body.files.length > 0) {
      expect(body.files[0]).toHaveProperty("type");
    }
  });
});
