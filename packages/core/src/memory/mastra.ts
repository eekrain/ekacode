/**
 * @ekacode/core
 *
 * Mastra instance configuration with Memory support
 */

import { Mastra } from "@mastra/core";
import { getMemory } from "./index";

export const mastra = new Mastra({
  // Configuration will be expanded as features are added
});

/**
 * Get the ekacode memory instance
 *
 * Convenience export for accessing memory functionality.
 */
export const memory = getMemory();
