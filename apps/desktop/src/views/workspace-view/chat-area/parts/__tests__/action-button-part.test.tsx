/**
 * ActionButtonPart Component Tests
 *
 * Tests for action_buttons part type rendering and interaction.
 */

import { render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionButtonPart, type ActionButtonPartData } from "../action-button-part";

describe("ActionButtonPart", () => {
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

  it("renders action_buttons part with buttons", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        {
          id: "btn-1",
          label: "Start Spec",
          action: "wizard:start:comprehensive",
          variant: "primary",
        },
        { id: "btn-2", label: "Quick Spec", action: "wizard:start:quick", variant: "secondary" },
      ],
    };

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} />, { container }));

    expect(container.textContent).toContain("Start Spec");
    expect(container.textContent).toContain("Quick Spec");
  });

  it("renders primary and secondary button variants correctly", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        { id: "btn-primary", label: "Primary Action", action: "action:1", variant: "primary" },
        {
          id: "btn-secondary",
          label: "Secondary Action",
          action: "action:2",
          variant: "secondary",
        },
      ],
    };

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} />, { container }));

    const buttons = container.querySelectorAll('button[data-slot="action-button"]');
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.getAttribute("data-variant")).toBe("primary");
    expect(buttons[1]?.getAttribute("data-variant")).toBe("secondary");
  });

  it("calls onAction with action id when button clicked", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        {
          id: "btn-1",
          label: "Click Me",
          action: "wizard:start:comprehensive",
          variant: "primary",
        },
      ],
    };
    const onAction = vi.fn();

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} onAction={onAction} />, {
      container,
    }));

    const button = container.querySelector(
      'button[data-action="wizard:start:comprehensive"]'
    ) as HTMLButtonElement;
    button.click();

    expect(onAction).toHaveBeenCalledWith("wizard:start:comprehensive", {
      id: "btn-1",
      label: "Click Me",
      action: "wizard:start:comprehensive",
      variant: "primary",
    });
  });

  it("shows loading state for specified button", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        { id: "btn-1", label: "Loading", action: "action:1", variant: "primary" },
        { id: "btn-2", label: "Normal", action: "action:2", variant: "secondary" },
      ],
      loadingButtonId: "btn-1",
    };

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} />, { container }));

    const loadingButton = container.querySelector('button[data-action="action:1"]');
    const normalButton = container.querySelector('button[data-action="action:2"]');

    expect(loadingButton?.getAttribute("data-loading")).toBe("true");
    expect(loadingButton?.hasAttribute("disabled")).toBe(true);
    expect(normalButton?.getAttribute("data-loading")).toBe("false");
    expect(normalButton?.hasAttribute("disabled")).toBe(false);
  });

  it("prevents duplicate clicks when button is loading", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [{ id: "btn-1", label: "Click Once", action: "action:1", variant: "primary" }],
      loadingButtonId: "btn-1",
    };
    const onAction = vi.fn();

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} onAction={onAction} />, {
      container,
    }));

    const button = container.querySelector('button[data-action="action:1"]') as HTMLButtonElement;
    button.click();
    button.click();
    button.click();

    expect(onAction).not.toHaveBeenCalled();
  });

  it("renders button with optional metadata", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        {
          id: "btn-1",
          label: "Spec Button",
          action: "wizard:requirements:approve",
          variant: "primary",
          metadata: { phase: "requirements", specSlug: "example" },
        },
      ],
    };

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} />, { container }));

    const button = container.querySelector('button[data-action="wizard:requirements:approve"]');
    expect(button).not.toBeNull();
    expect(container.textContent).toContain("Spec Button");
  });

  it("does not render buttons when array is empty", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [],
    };

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} />, { container }));

    const buttons = container.querySelectorAll('button[data-slot="action-button"]');
    expect(buttons.length).toBe(0);
  });

  it("handles disabled buttons", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        { id: "btn-1", label: "Disabled", action: "action:1", variant: "primary", disabled: true },
        { id: "btn-2", label: "Enabled", action: "action:2", variant: "secondary" },
      ],
    };

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} />, { container }));

    const disabledButton = container.querySelector('button[data-action="action:1"]');
    const enabledButton = container.querySelector('button[data-action="action:2"]');

    expect(disabledButton?.hasAttribute("disabled")).toBe(true);
    expect(enabledButton?.hasAttribute("disabled")).toBe(false);
  });

  it("does not call onAction when disabled button is clicked", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        {
          id: "btn-1",
          label: "Can't Click",
          action: "action:1",
          variant: "primary",
          disabled: true,
        },
      ],
    };
    const onAction = vi.fn();

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} onAction={onAction} />, {
      container,
    }));

    const button = container.querySelector('button[data-action="action:1"]') as HTMLButtonElement;
    button.click();

    expect(onAction).not.toHaveBeenCalled();
  });

  it("renders multiple buttons in order", () => {
    const part: ActionButtonPartData = {
      type: "action_buttons",
      buttons: [
        { id: "btn-1", label: "First", action: "action:1", variant: "primary" },
        { id: "btn-2", label: "Second", action: "action:2", variant: "secondary" },
        { id: "btn-3", label: "Third", action: "action:3", variant: "secondary" },
      ],
    };

    ({ unmount: dispose } = render(() => <ActionButtonPart part={part} />, { container }));

    const buttons = container.querySelectorAll('button[data-slot="action-button"]');
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.textContent).toContain("First");
    expect(buttons[1]?.textContent).toContain("Second");
    expect(buttons[2]?.textContent).toContain("Third");
  });
});
