/**
 * State management for Instance contexts
 *
 * Provides per-directory state storage that persists across
 * Instance.provide() calls with the same directory.
 */

/**
 * Get state storage for a specific directory
 *
 * @param directory - Directory key for state isolation
 * @returns Map-based state storage
 */
export function getState(directory: string): Map<string, unknown> {
  // Use a WeakMap for directory-based state storage
  // This ensures state is garbage collected when no longer needed
  if (!stateStore.has(directory)) {
    stateStore.set(directory, new Map<string, unknown>());
  }
  return stateStore.get(directory)!;
}

/**
 * Clear all state for a specific directory
 *
 * @param directory - Directory key to clear
 */
export function clearState(directory: string): void {
  stateStore.delete(directory);
}

/**
 * Clear all state (useful for testing)
 */
export function clearAllState(): void {
  stateStore.clear();
}

// State storage keyed by directory
const stateStore = new Map<string, Map<string, unknown>>();
