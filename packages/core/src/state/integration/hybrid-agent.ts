/**
 * HybridAgent integration with RLM workflow
 *
 * This module provides integration functions to connect XState's RLM
 * workflow with the HybridAgent for multimodal capabilities.
 */

import type { ActorRefFrom } from "xstate";
import { createActor } from "xstate";
import { createAbortError } from "../actors/runtime";
import { rlmMachine } from "../machine";
import type {
  AgentRuntime,
  ContentPart,
  HierarchicalState,
  Message,
  RLMMachineContext,
} from "../types";

/**
 * RLM workflow configuration
 */
export interface RLMConfig {
  /**
   * The user's goal/request
   */
  goal: string;

  /**
   * Initial messages for the conversation
   * Content can be a string or an array of content parts (for multimodal support)
   */
  messages?: Array<{ role: string; content: string | Array<ContentPart> }>;

  /**
   * Maximum iterations before doom loop protection
   */
  maxIterations?: number;

  /**
   * Workspace directory for file operations
   */
  workspace?: string;

  /**
   * Optional abort signal for cancellation.
   */
  signal?: AbortSignal;

  /**
   * Enable test mode to bypass real AI calls.
   */
  testMode?: boolean;
}

/**
 * RLM workflow result
 */
export interface RLMResult {
  /**
   * Whether the workflow completed successfully
   */
  success: boolean;

  /**
   * Final state reached by the workflow
   */
  finalState: HierarchicalState | "done" | "failed";

  /**
   * All messages exchanged during the workflow
   */
  messages: Array<Message>;

  /**
   * Error message if workflow failed
   */
  error?: string;
}

function assertValidConfig(config: RLMConfig): void {
  if (!config.goal || config.goal.trim().length === 0) {
    throw new Error("RLMConfig.goal is required");
  }
}

/**
 * Create an XState actor for the RLM workflow
 *
 * This creates an XState actor that can be started and observed
 * for state changes during the workflow.
 *
 * @param config - Workflow configuration
 * @returns XState actor for the RLM workflow
 */
export function createRLMActor(config: RLMConfig): ActorRefFrom<typeof rlmMachine> {
  assertValidConfig(config);
  const input: Partial<RLMMachineContext> = {
    goal: config.goal,
    messages: (config.messages as Message[] | undefined) ?? [],
    iterationCount: 0,
    recentStates: [],
    lastState: null,
    toolExecutionCount: 0,
    errorCounts: {},
    runtime: {
      signal: config.signal,
      testMode: config.testMode,
    } satisfies AgentRuntime,
  };

  return createActor(rlmMachine, {
    input,
  });
}

/**
 * Run RLM workflow and return a promise that resolves on completion
 *
 * This is a convenience function that starts the actor and returns
 * a promise that resolves when the workflow reaches a terminal state.
 *
 * @param config - Workflow configuration
 * @returns Promise that resolves when workflow completes with result
 */
export async function runRLMWorkflow(
  config: RLMConfig
): Promise<RLMResult & { _actor?: ReturnType<typeof createRLMActor> }> {
  const actor = createRLMActor(config);
  const signal = config.signal;

  if (signal?.aborted) {
    actor.stop();
    throw createAbortError();
  }

  let subscription: ReturnType<typeof actor.subscribe> | null = null;
  const promise = new Promise<RLMResult>((resolve, reject) => {
    const handleAbort = () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      actor.stop();
      reject(createAbortError());
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    subscription = actor.subscribe({
      next: snapshot => {
        // Check if we've reached a terminal state
        if (snapshot.status === "done" || snapshot.value === "done") {
          subscription?.unsubscribe();
          actor.stop();
          if (signal) {
            signal.removeEventListener("abort", handleAbort);
          }
          resolve({
            success: true,
            finalState: "done",
            messages: snapshot.context.messages,
          });
        }
        if (snapshot.value === "failed") {
          subscription?.unsubscribe();
          actor.stop();
          if (signal) {
            signal.removeEventListener("abort", handleAbort);
          }
          resolve({
            success: false,
            finalState: "failed",
            messages: snapshot.context.messages,
            error: "RLM workflow failed",
          });
        }
      },
      error: err => {
        subscription?.unsubscribe();
        actor.stop();
        if (signal) {
          signal.removeEventListener("abort", handleAbort);
        }
        reject(err);
      },
    });

    actor.start();
  });

  return Object.assign(promise, { _actor: actor });
}
