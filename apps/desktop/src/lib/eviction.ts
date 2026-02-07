/**
 * LRU Eviction System for Directory Stores
 *
 * Prevents memory leaks by evicting unused directory stores.
 * Tracks last access time and provides pin/unpin functionality.
 *
 * Based on opencode packages/app/src/context/global-sync/eviction.ts
 */

/**
 * Eviction constants
 */
export const MAX_DIR_STORES = 30;
export const DIR_IDLE_TTL_MS = 20 * 60 * 1000; // 20 minutes
export const SESSION_RECENT_LIMIT = 50;
export const SESSION_RECENT_WINDOW = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Directory state tracking
 */
export interface DirState {
  lastAccessAt: number;
  pinned: boolean;
  booting: boolean;
  loadingSessions: boolean;
}

/**
 * Eviction plan input
 */
export interface EvictPlan {
  stores: string[];
  max: number;
  ttl: number;
  now: number;
  pins: Set<string>;
  state: Map<string, DirState>;
}

/**
 * Dispose check input
 */
export interface DisposeCheck {
  directory: string;
  hasStore: boolean;
  pinned: boolean;
  booting: boolean;
  loadingSessions: boolean;
}

/**
 * Eviction result
 */
export interface EvictionResult {
  evicted: string[];
  kept: string[];
}

/**
 * Pick directories to evict based on LRU policy
 *
 * Rules:
 * 1. Never evict pinned directories
 * 2. Evict directories that exceed max stores limit
 * 3. Evict directories idle for longer than TTL
 * 4. Prioritize least recently accessed
 */
export function pickDirectoriesToEvict(input: EvictPlan): string[] {
  const overflow = Math.max(0, input.stores.length - input.max);
  let pendingOverflow = overflow;

  // Sort unpinned directories by last access time (oldest first)
  const sorted = input.stores
    .filter(dir => !input.pins.has(dir))
    .slice()
    .sort(
      (a, b) => (input.state.get(a)?.lastAccessAt ?? 0) - (input.state.get(b)?.lastAccessAt ?? 0)
    );

  const output: string[] = [];

  for (const dir of sorted) {
    const lastAccess = input.state.get(dir)?.lastAccessAt ?? 0;
    const idle = input.now - lastAccess >= input.ttl;

    // Evict if idle OR if we're over the limit
    if (!idle && pendingOverflow <= 0) continue;

    output.push(dir);
    if (pendingOverflow > 0) pendingOverflow -= 1;
  }

  return output;
}

/**
 * Check if a directory can be safely disposed
 *
 * Conditions:
 * - Directory must exist
 * - Store must exist
 * - Not pinned
 * - Not currently booting
 * - Not loading sessions
 */
export function canDisposeDirectory(input: DisposeCheck): boolean {
  if (!input.directory) return false;
  if (!input.hasStore) return false;
  if (input.pinned) return false;
  if (input.booting) return false;
  if (input.loadingSessions) return false;
  return true;
}

/**
 * Create initial directory state
 */
export function createInitialDirState(): DirState {
  return {
    lastAccessAt: Date.now(),
    pinned: false,
    booting: false,
    loadingSessions: false,
  };
}

/**
 * Update directory state access time
 */
export function touchDirState(state: DirState): DirState {
  return {
    ...state,
    lastAccessAt: Date.now(),
  };
}

/**
 * Pin a directory (prevent eviction)
 */
export function pinDirState(state: DirState): DirState {
  return {
    ...state,
    pinned: true,
    lastAccessAt: Date.now(),
  };
}

/**
 * Unpin a directory (allow eviction)
 */
export function unpinDirState(state: DirState): DirState {
  return {
    ...state,
    pinned: false,
  };
}

/**
 * Set booting state
 */
export function setBoilingState(state: DirState, booting: boolean): DirState {
  return {
    ...state,
    booting,
    lastAccessAt: Date.now(),
  };
}

/**
 * Set loading sessions state
 */
export function setLoadingSessionsState(state: DirState, loading: boolean): DirState {
  return {
    ...state,
    loadingSessions: loading,
    lastAccessAt: Date.now(),
  };
}
