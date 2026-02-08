import { describe, expect, it } from "vitest";
import { normalizeCheckpointMessages } from "../../src/routes/session-data-normalize";

describe("session-data normalization", () => {
  it("converts legacy model messages to unique ids and text parts", () => {
    const messages = normalizeCheckpointMessages({
      sessionID: "session-123",
      rawMessages: [
        { role: "system", content: "internal instructions" },
        { role: "user", content: "hello world" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "first answer" },
            { type: "tool-call", toolName: "read", args: { path: "a.ts" } },
          ],
        },
        { role: "tool", content: [{ type: "tool-result", result: "ok" }] },
      ],
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.info.role).toBe("user");
    expect(messages[1]?.info.role).toBe("assistant");
    expect(messages[0]?.info.id).not.toBe(messages[1]?.info.id);
    expect(messages[0]?.parts[0]?.type).toBe("text");
    expect(messages[0]?.parts[0]?.text).toBe("hello world");
    expect(messages[1]?.parts[0]?.text).toBe("first answer");
  });

  it("keeps canonical messages and normalizes missing part identifiers", () => {
    const messages = normalizeCheckpointMessages({
      sessionID: "session-123",
      rawMessages: [
        {
          info: {
            id: "msg-1",
            role: "assistant",
            sessionID: "session-123",
            time: { created: 100 },
          },
          parts: [{ type: "text", text: "answer" }],
          createdAt: 100,
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.info.id).toBe("msg-1");
    expect(messages[0]?.parts).toHaveLength(1);
    expect(messages[0]?.parts[0]?.id).toContain("msg-1-part-");
    expect(messages[0]?.parts[0]?.messageID).toBe("msg-1");
    expect(messages[0]?.parts[0]?.sessionID).toBe("session-123");
  });

  it("repairs malformed canonical history with repeated session id and empty parts", () => {
    const messages = normalizeCheckpointMessages({
      sessionID: "session-123",
      rawMessages: [
        {
          info: {
            id: "session-123",
            role: "user",
            sessionID: "session-123",
            time: { created: 10 },
          },
          parts: [],
          content: "user hello",
          createdAt: 10,
        },
        {
          info: {
            id: "session-123",
            role: "assistant",
            sessionID: "session-123",
            time: { created: 20 },
          },
          parts: [],
          content: "assistant reply",
          createdAt: 20,
        },
      ],
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.info.id).not.toBe(messages[1]?.info.id);
    expect(messages[0]?.parts[0]?.type).toBe("text");
    expect(messages[1]?.parts[0]?.type).toBe("text");
    expect(messages[0]?.parts[0]?.text).toBe("user hello");
    expect(messages[1]?.parts[0]?.text).toBe("assistant reply");
  });
});
