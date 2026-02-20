import { describe, expect, it } from "vitest";
import { generate, generateMany } from "./index.js";

describe("generate", () => {
  it("returns an object with dashed, raw, and spaced properties", () => {
    const result = generate();
    expect(result).toHaveProperty("dashed");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("spaced");
  });

  it("generates a name with default 2 words", () => {
    const result = generate();
    expect(result.raw).toHaveLength(2);
    expect(result.dashed.split("-")).toHaveLength(2);
    expect(result.spaced.split(" ")).toHaveLength(2);
  });

  it("generates a random name each time", () => {
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(generate().dashed);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("uses only lowercase letters", () => {
    for (let i = 0; i < 50; i++) {
      const result = generate();
      expect(result.dashed).toBe(result.dashed.toLowerCase());
      expect(result.spaced).toBe(result.spaced.toLowerCase());
    }
  });

  it("returns dashed format with hyphen", () => {
    const result = generate();
    expect(result.dashed).toContain("-");
  });

  it("returns spaced format with space", () => {
    const result = generate();
    expect(result.spaced).toContain(" ");
  });

  it("returns raw as array of words", () => {
    const result = generate();
    expect(Array.isArray(result.raw)).toBe(true);
  });
});

describe("generate with words option", () => {
  it("generates name with 1 word", () => {
    const result = generate({ words: 1 });
    expect(result.raw).toHaveLength(1);
  });

  it("generates name with 3 words", () => {
    const result = generate({ words: 3 });
    expect(result.raw).toHaveLength(3);
  });

  it("generates name with 4 words", () => {
    const result = generate({ words: 4 });
    expect(result.raw).toHaveLength(4);
  });
});

describe("generate with number option", () => {
  it("includes a number when number is true", () => {
    const result = generate({ number: true });
    const hasNumber = result.raw.some(item => !Number.isNaN(Number(item)));
    expect(hasNumber).toBe(true);
  });

  it("adds number at the end", () => {
    const result = generate({ number: true });
    const lastItem = result.raw[result.raw.length - 1];
    expect(String(lastItem)).toMatch(/^\d+$/);
  });
});

describe("generate with alliterative option", () => {
  it("generates alliterative words", () => {
    const result = generate({ alliterative: true });
    if (result.raw.length > 1) {
      const firstLetter = result.raw[0][0];
      for (let i = 1; i < result.raw.length - 1; i++) {
        expect(result.raw[i][0]).toBe(firstLetter);
      }
    }
  });

  it("works with multiple words", () => {
    const result = generate({ words: 3, alliterative: true });
    expect(result.raw).toHaveLength(3);
    const firstLetter = result.raw[0][0];
    expect(result.raw[1][0]).toBe(firstLetter);
    expect(result.raw[2][0]).toBe(firstLetter);
  });
});

describe("generateMany", () => {
  it("generates specified number of names", () => {
    const results = generateMany(5);
    expect(results).toHaveLength(5);
  });

  it("returns array of name objects", () => {
    const results = generateMany(3);
    results.forEach(result => {
      expect(result).toHaveProperty("dashed");
      expect(result).toHaveProperty("raw");
      expect(result).toHaveProperty("spaced");
    });
  });

  it("generates unique names", () => {
    const results = generateMany(10);
    const dashedSet = new Set(results.map(r => r.dashed));
    expect(dashedSet.size).toBe(10);
  });

  it("accepts options", () => {
    const results = generateMany(3, { words: 3 });
    results.forEach(result => {
      expect(result.raw).toHaveLength(3);
    });
  });
});
