/**
 * Message Part Component Registry
 *
 * Opencode-style dynamic part rendering with registry pattern.
 * Parts are rendered based on their type using a component registry.
 *
 * Usage:
 * 1. Register a component: registerPartComponent("text", TextPartDisplay)
 * 2. Render parts: <Part part={part} message={message} />
 */

import type { Part as CorePart, Message } from "@ekacode/core/chat";
import { Component, createMemo, Show, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

// Re-export with local alias for convenience
export type Part = CorePart;

/**
 * Props for message part components
 */
export interface MessagePartProps {
  part: Part;
  message: Message;
  hideDetails?: boolean;
  defaultOpen?: boolean;
}

/**
 * Part component type
 */
export type PartComponent = Component<MessagePartProps>;

/**
 * Part component registry
 * Maps part type -> component
 */
const PART_MAPPING = new Map<string, PartComponent>();

/**
 * Register a part component for a specific part type
 * @param type - Part type (e.g., "text", "tool", "reasoning")
 * @param component - Component to render for this part type
 */
export function registerPartComponent(type: string, component: PartComponent): void {
  PART_MAPPING.set(type, component);
}

/**
 * Get a registered part component
 * @param type - Part type
 * @returns Component or undefined
 */
export function getPartComponent(type: string): PartComponent | undefined {
  return PART_MAPPING.get(type);
}

/**
 * Part component - dynamically renders based on part type
 *
 * Looks up the part type in the registry and renders the appropriate component.
 * Shows nothing if no component is registered for the type.
 */
export function Part(props: MessagePartProps): JSX.Element {
  const component = createMemo(() => PART_MAPPING.get(props.part.type));

  return (
    <Show when={component()}>
      {comp => (
        <Dynamic
          component={comp()}
          part={props.part}
          message={props.message}
          hideDetails={props.hideDetails}
          defaultOpen={props.defaultOpen}
        />
      )}
    </Show>
  );
}
