/**
 * ActionButtonPart Component
 *
 * Renders grouped action buttons in the message timeline.
 * Supports primary/secondary variants, loading states, and duplicate-click prevention.
 */

import { cn } from "@/utils";
import type { PartProps } from "@/views/workspace-view/chat-area/parts/part-registry";
import { For, Show, type Component } from "solid-js";

/**
 * Button variant types
 */
export type ActionButtonVariant = "primary" | "secondary";

/**
 * Action button definition
 */
export interface ActionButton {
  /** Unique button identifier */
  id: string;
  /** Button display label */
  label: string;
  /** Canonical action ID (e.g., wizard:start:comprehensive) */
  action: string;
  /** Visual variant */
  variant: ActionButtonVariant;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
  /** Whether button is disabled */
  disabled?: boolean;
}

/**
 * Action buttons part data structure
 */
export interface ActionButtonPartData {
  type: "action_buttons";
  /** Array of buttons to display */
  buttons: ActionButton[];
  /** ID of button currently in loading state */
  loadingButtonId?: string;
}

/**
 * Check if a button should be disabled (explicitly disabled or loading)
 */
function isButtonDisabled(button: ActionButton, loadingButtonId: string | undefined): boolean {
  return button.disabled === true || button.id === loadingButtonId;
}

/**
 * Get variant classes for a button
 */
function getVariantClasses(variant: ActionButtonVariant): string {
  return cn(
    "rounded px-3 py-1.5 text-sm transition-colors",
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
  );
}

/**
 * ActionButtonPart component
 *
 * Renders a group of actionable buttons with support for:
 * - Primary and secondary variants
 * - Loading state with disabled state
 * - Duplicate-click prevention
 * - Optional metadata
 */
export const ActionButtonPart: Component<
  PartProps & {
    /** Callback when button action is clicked */
    onAction?: (action: string, button: ActionButton) => void | Promise<void>;
  }
> = props => {
  const part = () => props.part as unknown as ActionButtonPartData;
  const buttons = () => part().buttons || [];
  const loadingButtonId = () => part().loadingButtonId;

  const handleButtonClick = (button: ActionButton) => {
    // Prevent clicks on disabled or loading buttons
    if (isButtonDisabled(button, loadingButtonId())) {
      return;
    }

    void props.onAction?.(button.action, button);
  };

  // Don't render anything if no buttons
  if (buttons().length === 0) {
    return null;
  }

  return (
    <div data-component="action-button-part" class="action-button-part space-y-2">
      <div data-slot="action-buttons" class="flex flex-wrap gap-2">
        <For each={buttons()}>
          {button => {
            const isLoading = () => button.id === loadingButtonId();
            const isDisabled = () => isButtonDisabled(button, loadingButtonId());

            return (
              <button
                data-slot="action-button"
                data-action={button.action}
                data-variant={button.variant}
                data-id={button.id}
                data-loading={isLoading() ? "true" : "false"}
                type="button"
                disabled={isDisabled()}
                class={cn(
                  getVariantClasses(button.variant),
                  isDisabled() ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                )}
                onClick={() => handleButtonClick(button)}
              >
                <Show when={isLoading()}>
                  <span data-slot="loading-indicator" class="mr-1 inline-block animate-spin">
                    ⏳
                  </span>
                </Show>
                <span data-slot="button-label">{button.label}</span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};
