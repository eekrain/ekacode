import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_CSS_PATH = resolve(process.cwd(), "src/assets/main.css");

describe("main.css structure", () => {
  it("loads domain css files through explicit imports", () => {
    const css = readFileSync(MAIN_CSS_PATH, "utf-8");
    expect(css).toContain('@import "./styles/tokens.css";');
    expect(css).toContain('@import "./styles/animations.css";');
    expect(css).toContain('@import "./styles/scrollbars.css";');
    expect(css).toContain('@import "./styles/markdown.css";');
    expect(css).toContain('@import "./styles/command-dialog.css";');
  });

  it("does not include legacy antigravity style rules", () => {
    const css = readFileSync(MAIN_CSS_PATH, "utf-8");
    expect(css).not.toContain(".ag-run-card");
    expect(css).not.toContain("--ag-thought");
  });
});
