import { createMarkdownStreamQueue } from "@/components/ui/markdown-stream-queue";
import { describe, expect, it } from "vitest";

describe("markdown-stream-queue", () => {
  it("yields pushed chunks in order", async () => {
    const q = createMarkdownStreamQueue();
    const stream = q.stream();

    q.push("hello");
    q.push(" world");
    q.close();

    const out: string[] = [];
    for await (const chunk of stream) out.push(chunk);
    expect(out).toEqual(["hello", " world"]);
  });

  it("stops when closed", async () => {
    const q = createMarkdownStreamQueue();
    q.close();
    const out: string[] = [];
    for await (const chunk of q.stream()) out.push(chunk);
    expect(out).toEqual([]);
  });
});
