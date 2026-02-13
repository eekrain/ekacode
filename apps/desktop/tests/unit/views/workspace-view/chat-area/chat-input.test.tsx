import { ChatInput } from "@/views/workspace-view/chat-area/chat-input";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ChatInput", () => {
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

  it("renders with placeholder and character count", () => {
    dispose = render(() => <ChatInput placeholder="Custom placeholder" />, container);

    const textarea = container.querySelector("textarea");
    expect(textarea?.getAttribute("placeholder")).toBe("Custom placeholder");
    expect(container.textContent).toContain("0 chars");
  });

  it("calls onValueChange when user types", () => {
    const onValueChange = vi.fn();

    dispose = render(() => <ChatInput onValueChange={onValueChange} />, container);

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Hello";
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));

    expect(onValueChange).toHaveBeenCalledWith("Hello");
  });

  it("submits on Enter without Shift", () => {
    const onSend = vi.fn();

    dispose = render(() => <ChatInput value="Hello" onSend={onSend} />, container);

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Shift+Enter", () => {
    const onSend = vi.fn();

    dispose = render(() => <ChatInput value="Hello" onSend={onSend} />, container);

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true })
    );

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables send action while isSending is true", () => {
    const onSend = vi.fn();

    dispose = render(() => <ChatInput value="Hello" onSend={onSend} isSending={true} />, container);

    const send = container.querySelector('button[aria-label="Send"]') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    send.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onModeChange when toggling mode", () => {
    const onModeChange = vi.fn();
    const [mode, setMode] = createSignal<"plan" | "build">("plan");

    dispose = render(
      () => (
        <ChatInput
          mode={mode()}
          onModeChange={next => {
            onModeChange(next);
            setMode(next);
          }}
        />
      ),
      container
    );

    const toggle = container.querySelector('button[title^="Switch to"]') as HTMLButtonElement;
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onModeChange).toHaveBeenCalledWith("build");
  });
});
