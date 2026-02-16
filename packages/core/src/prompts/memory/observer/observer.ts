/**
 * Observer Agent Prompts
 *
 * Compatibility wrapper for default observer prompt exports.
 * Prompt composition is centralized in observer-modes.ts.
 */

import { buildObserverSystemPrompt } from "./modes";

export {
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_GUIDELINES,
  OBSERVER_OUTPUT_FORMAT,
} from "./shared";

export const OBSERVER_SYSTEM_PROMPT = buildObserverSystemPrompt("default");
