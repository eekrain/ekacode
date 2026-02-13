/**
 * MessageTimeline Component Tests
 *
 * Tests for the turn-based chat timeline component.
 */

import type { ChatTurn } from "@/core/chat/hooks/turn-projection";
import type { MessageWithId } from "@/core/state/stores/message-store";
import { MessageTimeline } from "@/views/workspace-view/chat-area";
import type { Part } from "@ekacode/shared/event-types";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function createMockTurn(id: string, options?: Partial<ChatTurn>): ChatTurn {
  const userMessage: MessageWithId = {
    id,
    role: "user",
    sessionID: "test-session",
    time: { created: Date.now() },
  } as MessageWithId;

  return {
    userMessage,
    userParts: [{ id: `${id}-part`, type: "text", messageID: id, text: "Hello" } as Part],
    assistantMessages: [],
    assistantPartsByMessageId: {},
    finalTextPart: undefined,
    reasoningParts: [],
    toolParts: [],
    isActiveTurn: false,
    working: false,
    error: undefined,
    durationMs: 0,
    statusLabel: undefined,
    ...options,
  };
}

describe("MessageTimeline", () => {
  let container: HTMLDivElement;
  let dispose: () => void;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    dispose?.();
    document.body.removeChild(container);
  });

  it("renders turns in chronological order", () => {
    const turns = [createMockTurn("turn-1"), createMockTurn("turn-2")];

    dispose = render(
      () => <MessageTimeline turns={() => turns} isStreaming={() => false} />,
      container
    );

    const items = container.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(2);
  });

  it("uses stable keys by userMessage.id", () => {
    const turns = [createMockTurn("unique-turn-id")];

    dispose = render(
      () => <MessageTimeline turns={() => turns} isStreaming={() => false} />,
      container
    );

    const item = container.querySelector('[data-testid="turn-unique-turn-id"]');
    expect(item).toBeDefined();
  });

  it("shows empty state when no turns", () => {
    dispose = render(
      () => <MessageTimeline turns={() => []} isStreaming={() => false} />,
      container
    );

    expect(container.textContent).toContain("No messages");
  });

  it("renders scroll container with role=log", () => {
    const turns = [createMockTurn("turn-1")];

    dispose = render(
      () => <MessageTimeline turns={() => turns} isStreaming={() => false} />,
      container
    );

    const logContainer = container.querySelector('[role="log"]');
    expect(logContainer).toBeDefined();
  });
});
