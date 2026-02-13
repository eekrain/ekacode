import type { ChatTurn } from "@/core/chat/hooks/turn-projection";
import type { MessageWithId } from "@/core/state/stores/message-store";
import { SessionTurn } from "@/views/workspace-view/chat-area";
import type { Part } from "@ekacode/shared/event-types";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createBaseTurn(overrides?: Partial<ChatTurn>): ChatTurn {
  const userMessage: MessageWithId = {
    id: "user-1",
    role: "user",
    sessionID: "session-1",
    time: { created: Date.now() },
  } as MessageWithId;

  const assistantMessage: MessageWithId = {
    id: "assistant-1",
    role: "assistant",
    parentID: "user-1",
    sessionID: "session-1",
    time: { created: Date.now() + 10 },
  } as MessageWithId;

  const finalTextPart = {
    id: "assistant-1-text",
    type: "text",
    messageID: "assistant-1",
    text: "Working on your request...",
  } as Part;

  return {
    userMessage,
    userParts: [{ id: "user-1-text", type: "text", messageID: "user-1", text: "Hi" } as Part],
    assistantMessages: [assistantMessage],
    assistantPartsByMessageId: {
      "assistant-1": [finalTextPart],
    },
    finalTextPart,
    reasoningParts: [],
    toolParts: [],
    isActiveTurn: true,
    working: false,
    error: undefined,
    durationMs: 1200,
    statusLabel: "Gathering thoughts",
    ...overrides,
  };
}

describe("SessionTurn", () => {
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

  it("renders assistant text while the turn is still working", () => {
    const turn = createBaseTurn({ working: true });

    dispose = render(() => <SessionTurn turn={() => turn} isStreaming={() => true} />, container);

    expect(container.textContent).toContain("Working on your request...");
    expect(container.textContent).toContain("Gathering thoughts");
  });

  it("invokes retry, copy, and delete handlers from action buttons", () => {
    const onRetry = vi.fn();
    const onCopy = vi.fn();
    const onDelete = vi.fn();
    const turn = createBaseTurn({ working: false });

    dispose = render(
      () => (
        <SessionTurn
          turn={() => turn}
          isStreaming={() => false}
          onRetry={onRetry}
          onCopy={onCopy}
          onDelete={onDelete}
        />
      ),
      container
    );

    const retryButton = Array.from(container.querySelectorAll("button")).find(
      button => button.textContent === "Retry"
    );
    const copyButton = Array.from(container.querySelectorAll("button")).find(
      button => button.textContent === "Copy"
    );
    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      button => button.textContent === "Delete"
    );

    retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onRetry).toHaveBeenCalledWith("user-1");
    expect(onCopy).toHaveBeenCalledWith("assistant-1");
    expect(onDelete).toHaveBeenCalledWith("user-1");
  });
});
