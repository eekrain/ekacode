import type { ChatMessage } from "@ekacode/desktop/presentation/hooks/use-messages";
import { selectAssistantMessagesForTurn } from "@ekacode/desktop/views/workspace-view/chat-area/session-turn";
import { describe, expect, it, vi } from "vitest";

// Mock console.warn to test warnings
const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

function msg(input: Partial<ChatMessage> & Pick<ChatMessage, "id" | "role">): ChatMessage {
  return {
    parts: [],
    createdAt: 0,
    sessionId: "s1",
    ...input,
  };
}

describe("SessionTurn selection robustness", () => {
  beforeEach(() => {
    consoleWarnSpy.mockClear();
  });

  describe("user message not found", () => {
    it("should return empty array when user message does not exist", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "u1" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "non-existent-id");

      expect(result).toEqual([]);
    });

    it("should return empty array when message exists but is not a user message", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "u1" }),
      ];

      // Try to select using assistant message ID
      const result = selectAssistantMessagesForTurn(timeline, "a1");

      expect(result).toEqual([]);
    });
  });

  describe("partial parentId linkage", () => {
    it("should merge parentId-linked and window-based selection when linkage is partial", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "u1" }), // Linked
        msg({ id: "a2", role: "assistant" }), // Not linked but in window
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      // Should include both linked and windowed assistants
      expect(result.map(m => m.id)).toContain("a1");
      expect(result.map(m => m.id)).toContain("a2");
    });

    it("should deduplicate when assistant appears in both linkage and window", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "u1" }), // Both linked and in window
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      // a1 should appear only once
      expect(result.filter(m => m.id === "a1")).toHaveLength(1);
    });
  });

  describe("invalid parentId references", () => {
    it("should fallback to window-based selection when parentId references non-existent user", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "non-existent-user" }), // Invalid parentId
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      // Should still find a1 via window-based fallback
      expect(result.map(m => m.id)).toContain("a1");
    });

    it("should handle assistant with parentId pointing to another assistant", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "u1" }),
        msg({ id: "a2", role: "assistant", parentId: "a1" }), // parentId points to assistant
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      // Should include a1 (correctly linked) and a2 (via window)
      expect(result.map(m => m.id)).toContain("a1");
      expect(result.map(m => m.id)).toContain("a2");
    });
  });

  describe("assistant before user (window-based fallback)", () => {
    it("should find assistant messages that appear before user message via window", () => {
      const timeline: ChatMessage[] = [
        // Assistant created first (orphaned temporarily)
        msg({ id: "a1", role: "assistant", parentId: "u1" }),
        msg({ id: "u1", role: "user" }),
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      // Should find a1 via window-based selection
      expect(result.map(m => m.id)).toContain("a1");
    });

    it("should not include assistants before user message (no preceding user)", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "a1", role: "assistant" }),
        msg({ id: "a2", role: "assistant" }),
        msg({ id: "u1", role: "user" }),
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      // Assistants before the first user message are not attributed to any turn
      // They may be system messages or orphaned - should not appear in u1's turn
      expect(result.map(m => m.id)).not.toContain("a1");
      expect(result.map(m => m.id)).not.toContain("a2");
    });
  });

  describe("edge cases", () => {
    it("should handle empty timeline", () => {
      const result = selectAssistantMessagesForTurn([], "u1");
      expect(result).toEqual([]);
    });

    it("should handle timeline with only user messages", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");
      expect(result).toEqual([]);
    });

    it("should handle timeline with only assistant messages", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "a1", role: "assistant" }),
        msg({ id: "a2", role: "assistant" }),
      ];

      // Even without user message, searching for non-existent user should return empty
      const result = selectAssistantMessagesForTurn(timeline, "u1");
      expect(result).toEqual([]);
    });

    it("should handle last user turn (no next user)", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "u1" }),
        msg({ id: "a2", role: "assistant", parentId: "u1" }),
        // No more users
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      expect(result.map(m => m.id)).toEqual(["a1", "a2"]);
    });

    it("should handle system messages in timeline", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "s1", role: "system" }),
        msg({ id: "u1", role: "user" }),
        msg({ id: "a1", role: "assistant", parentId: "u1" }),
        msg({ id: "s2", role: "system" }),
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      expect(result.map(m => m.id)).toContain("a1");
    });
  });

  describe("ordering preservation", () => {
    it("should preserve chronological order of assistant messages", () => {
      const timeline: ChatMessage[] = [
        msg({ id: "u1", role: "user" }),
        msg({ id: "a2", role: "assistant", parentId: "u1", createdAt: 200 }),
        msg({ id: "a1", role: "assistant", parentId: "u1", createdAt: 100 }),
        msg({ id: "a3", role: "assistant", parentId: "u1", createdAt: 300 }),
        msg({ id: "u2", role: "user" }),
      ];

      const result = selectAssistantMessagesForTurn(timeline, "u1");

      // Should maintain timeline order, not parentId order
      expect(result.map(m => m.id)).toEqual(["a2", "a1", "a3"]);
    });
  });
});
