import { sanitizeForIncremark } from "@/components/ui/markdown-sanitize";
import { describe, expect, it } from "vitest";

describe("sanitizeForIncremark", () => {
  it("keeps valid inline links unchanged", () => {
    const source = "Read [guide](https://example.com/guide) for details.";
    expect(sanitizeForIncremark(source)).toBe(source);
  });

  it("escapes unresolved reference links", () => {
    const source = "See [guide][docs] for setup.";
    expect(sanitizeForIncremark(source)).toBe("See \\[guide][docs] for setup.");
  });

  it("keeps resolved reference links unchanged", () => {
    const source = "[guide][docs]\n\n[docs]: https://example.com/docs";
    expect(sanitizeForIncremark(source)).toBe(source);
  });

  it("escapes unresolved shortcut references", () => {
    const source = "Open [docs] next.";
    expect(sanitizeForIncremark(source)).toBe("Open \\[docs] next.");
  });

  it("keeps resolved shortcut references unchanged", () => {
    const source = "[docs]\n\n[docs]: https://example.com/docs";
    expect(sanitizeForIncremark(source)).toBe(source);
  });

  it("escapes dangling reference definition lines", () => {
    const source = "temp reference:\n[docs]:\nnext line";
    expect(sanitizeForIncremark(source)).toBe("temp reference:\n\\[docs]:\nnext line");
  });

  it("escapes incomplete inline links", () => {
    const source = "streaming [guide](https://example.com";
    expect(sanitizeForIncremark(source)).toBe("streaming \\[guide](https://example.com");
  });

  it("does not alter fenced code blocks", () => {
    const source = "```md\n[guide][docs]\n[docs]:\n```";
    expect(sanitizeForIncremark(source)).toBe(source);
  });

  it("is idempotent", () => {
    const source = "See [guide][docs]\n[docs]:";
    const once = sanitizeForIncremark(source);
    const twice = sanitizeForIncremark(once);
    expect(twice).toBe(once);
  });
});
