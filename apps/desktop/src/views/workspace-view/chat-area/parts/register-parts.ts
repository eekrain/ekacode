/**
 * Register Default Part Components
 *
 * Registers the default part components for text, reasoning, tool, permission, and question types.
 * Call this function during app initialization to set up the part registry.
 */

import { registerPartComponent } from "./part-registry";
import { PermissionPart } from "./permission-part";
import { QuestionPart } from "./question-part";
import { ReasoningPart } from "./reasoning-part";
import { RetryPart } from "./retry-part";
import { TextPart } from "./text-part";
import { ToolPart } from "./tool-part";

let registered = false;

/**
 * Register default part components for the chat area.
 * Safe to call multiple times - will only register once.
 */
export function registerDefaultPartComponents(): void {
  if (registered) return;

  registerPartComponent("text", TextPart);
  registerPartComponent("reasoning", ReasoningPart);
  registerPartComponent("tool", ToolPart);
  registerPartComponent("permission", PermissionPart);
  registerPartComponent("question", QuestionPart);
  registerPartComponent("retry", RetryPart);

  registered = true;
}

/**
 * Reset registration state (for testing)
 */
export function resetRegistration(): void {
  registered = false;
}
