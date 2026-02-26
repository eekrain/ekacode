import { app } from "@/app/app";
import { describe, expect, test } from "vitest";

describe("Create app composition test scaffold", () => {
  test("enforces expected contract", async () => {
    const res = await app.request("/__plan_probe__");
    expect(res.status).not.toBe(500);
  });
});
