/**
 * Instance context system
 *
 * Public API for context-aware operations using AsyncLocalStorage.
 * Replaces the singleton WorkspaceInstance pattern with automatic
 * context propagation through async call stacks.
 */

import path from "node:path";
import { v7 as uuidv7 } from "uuid";
import { bootstrapProject } from "./bootstrap";
import {
  type InstanceContext,
  type ProjectInfo,
  type VCSInfo,
  getContext,
  runWithContext,
} from "./context";
import { getState } from "./state";

/**
 * Instance context management API
 *
 * Provides dependency injection pattern for workspace context that
 * automatically propagates through async call stacks.
 *
 * @example
 * ```ts
 * await Instance.provide({
 *   directory: "/path/to/project",
 *   async fn() {
 *     console.log(Instance.directory); // "/path/to/project"
 *     const { sessionID } = Instance.context;
 *   }
 * });
 * ```
 */
export const Instance = {
  /**
   * Establish a context boundary and execute a function within it
   *
   * @param input - Configuration for the context
   * @returns The result of the provided function
   *
   * @example
   * ```ts
   * const result = await Instance.provide({
   *   directory: "/project",
   *   async fn() {
   *     return "success";
   *   }
   * });
   * ```
   */
  async provide<R>(input: {
    directory: string;
    sessionID?: string;
    messageID?: string;
    agent?: string;
    abort?: AbortSignal;
    fn: () => Promise<R>;
    init?: (context: InstanceContext) => Promise<void>;
  }): Promise<R> {
    const absoluteDir = path.resolve(input.directory);

    // Check if we're in an existing context with the same directory
    const existingContext = getCurrentContextIfMatches(absoluteDir, input.sessionID);

    if (existingContext) {
      // Reuse existing context - don't create nested context
      return input.fn();
    }

    // Create new context
    const context: InstanceContext = {
      directory: absoluteDir,
      sessionID: input.sessionID ?? uuidv7(),
      messageID: input.messageID ?? uuidv7(),
      createdAt: Date.now(),
      agent: input.agent,
      abort: input.abort,
    };

    return runWithContext(context, async () => {
      // Run optional init hook
      if (input.init) {
        await input.init(context);
      }
      return input.fn();
    });
  },

  /**
   * Get the current working directory
   *
   * @throws If called outside of Instance.provide()
   */
  get directory(): string {
    return getContext().directory;
  },

  /**
   * Get the current project information
   *
   * @returns Project info if available, undefined otherwise
   */
  get project(): ProjectInfo | undefined {
    const context = getCurrentContext();
    return context?.project;
  },

  /**
   * Get the current VCS information
   *
   * @returns VCS info if available, undefined otherwise
   */
  get vcs(): VCSInfo | undefined {
    const context = getCurrentContext();
    return context?.vcs;
  },

  /**
   * Check if we're currently inside an Instance.provide() context
   *
   * @returns true if in context, false otherwise
   */
  get inContext(): boolean {
    try {
      getContext();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get the full current context
   *
   * @throws If called outside of Instance.provide()
   */
  get context(): InstanceContext {
    return getContext();
  },

  /**
   * State management for the current instance
   *
   * State is keyed by directory and persists across Instance.provide()
   * calls with the same directory.
   */
  state: {
    /**
     * Get a value from state
     *
     * @param key - State key
     * @returns The value if set, undefined otherwise
     */
    get<K>(key: string): K | undefined {
      const context = getCurrentContext();
      if (!context) return undefined;

      const state = getState(context.directory);
      return state.get(key) as K | undefined;
    },

    /**
     * Set a value in state
     *
     * @param key - State key
     * @param value - Value to store
     */
    set<K>(key: string, value: K): void {
      const context = getCurrentContext();
      if (!context) return;

      const state = getState(context.directory);
      state.set(key, value);
    },

    /**
     * Clear all state for the current directory
     */
    clear(): void {
      const context = getCurrentContext();
      if (!context) return;

      const state = getState(context.directory);
      state.clear();
    },
  },

  /**
   * Bootstrap project detection and VCS information
   *
   * Populates `Instance.project` and `Instance.vcs` by detecting
   * project structure and version control system information.
   *
   * @example
   * ```ts
   * await Instance.provide({
   *   directory: "/project",
   *   async fn() {
   *     await Instance.bootstrap();
   *     console.log(Instance.project?.name);
   *     console.log(Instance.vcs?.branch);
   *   }
   * });
   * ```
   */
  async bootstrap(): Promise<void> {
    const context = getContext();
    await bootstrapProject(context);
  },
};

/**
 * Get current context if it exists, without throwing
 */
function getCurrentContext(): InstanceContext | undefined {
  try {
    return getContext();
  } catch {
    return undefined;
  }
}

/**
 * Get current context only if it matches the specified directory
 *
 * This enables nested provide() calls with the same directory to
 * reuse the existing context instead of creating a new one.
 */
function getCurrentContextIfMatches(
  directory: string,
  sessionID?: string
): InstanceContext | undefined {
  try {
    const context = getContext();
    // Only reuse if directory matches exactly
    if (context.directory === directory) {
      if (sessionID && context.sessionID !== sessionID) {
        return undefined;
      }
      return context;
    }
  } catch {
    // No context exists
  }
  return undefined;
}

// Re-export types
export type { InstanceContext, ProjectInfo, VCSInfo } from "./context";
