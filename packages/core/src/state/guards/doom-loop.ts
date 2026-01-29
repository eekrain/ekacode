/**
 * Doom loop detection guards
 *
 * This module provides guards to detect and prevent infinite loops
 * in the RLM workflow through oscillation, time, and error progress checks.
 */

import type { RLMMachineContext, RecentStateEntry } from "../types";

/**
 * Doom loop detection result
 */
export interface DoomLoopResult {
  isDoomLoop: boolean;
  reason: string | null;
}

/**
 * Doom loop detection configuration
 */
const DOOM_LOOP_CONFIG = {
  oscillationThreshold: 5, // Number of implement → validate transitions
  timeLimitMinutes: 10, // Maximum time in build mode
  errorStagnationThreshold: 5, // Iterations without error reduction
};

/**
 * Check for doom loop conditions
 *
 * Detects three types of doom loops:
 * 1. Oscillation: Too many implement → validate transitions
 * 2. Time: Spent too long in build mode
 * 3. Error stagnation: Error counts not decreasing over iterations
 *
 * @param context - Current machine context
 * @returns Doom loop detection result
 */
export function doomLoopGuard(context: RLMMachineContext): DoomLoopResult {
  const { recentStates, iterationCount, errorCounts, lastState } = context;

  // Check for oscillation doom loop
  const oscillations = countBuildOscillations(recentStates);
  if (oscillations >= DOOM_LOOP_CONFIG.oscillationThreshold) {
    return {
      isDoomLoop: true,
      reason: `Oscillation detected: ${oscillations} implement → validate transitions`,
    };
  }

  // Check for time-based doom loop
  if (recentStates.length >= 2) {
    // Fixed: recentStates[0] is oldest (first in), recentStates[length-1] is newest
    const oldestTimestamp = recentStates[0]?.timestamp ?? Date.now();
    const timeInBuild = Date.now() - oldestTimestamp;
    const timeLimitMs = DOOM_LOOP_CONFIG.timeLimitMinutes * 60 * 1000;

    if (timeInBuild > timeLimitMs && lastState?.startsWith("build.")) {
      return {
        isDoomLoop: true,
        reason: `Time limit exceeded: spent ${Math.round(timeInBuild / 1000)}s in build mode`,
      };
    }
  }

  // Check for error stagnation
  if (iterationCount > DOOM_LOOP_CONFIG.errorStagnationThreshold) {
    const totalErrors = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);
    if (totalErrors > 0 && !isErrorProgress(errorCounts)) {
      return {
        isDoomLoop: true,
        reason: `Error stagnation: ${totalErrors} errors not decreasing over ${iterationCount} iterations`,
      };
    }
  }

  return {
    isDoomLoop: false,
    reason: null,
  };
}

/**
 * Check if validation output contains errors
 *
 * Looks for common error patterns in LSP output:
 * - TypeScript errors (TS####)
 * - ESLint errors
 * - Test failures
 *
 * @param output - Validation output from LSP or testing tools
 * @returns True if errors are detected
 */
export function hasValidationErrors(output: string): boolean {
  if (!output || output.trim().length === 0) {
    return false;
  }

  // Check for TypeScript errors
  if (/error TS\d+:/.test(output)) {
    return true;
  }

  // Check for ESLint errors
  if (/error\s+\w+\/\w+/.test(output)) {
    return true;
  }

  // Check for test failures
  if (/FAIL|failed|failure/i.test(output) && !/no failures/i.test(output)) {
    return true;
  }

  return false;
}

/**
 * Check if build output indicates success
 *
 * Looks for success indicators in build output:
 * - "Build successful"
 * - "All tests passed"
 * - "No errors found"
 *
 * @param output - Build output from compilation or testing
 * @returns True if build is clean
 */
export function isBuildClean(output: string): boolean {
  if (!output || output.trim().length === 0) {
    return false;
  }

  // Check for success indicators
  const successPatterns = [
    /build successful/i,
    /all tests passed/i,
    /no errors found/i,
    /completed successfully/i,
    /0 errors/i,
  ];

  return successPatterns.some(pattern => pattern.test(output));
}

/**
 * Count build oscillations in recent state history
 *
 * An oscillation is ANY transition between build states (implement ⇄ validate).
 * High oscillation counts indicate the agent is stuck in a loop.
 *
 * @param recentStates - Array of recent state entries
 * @returns Number of build state transitions
 */
export function countBuildOscillations(recentStates: RecentStateEntry[]): number {
  let oscillations = 0;

  for (let i = 0; i < recentStates.length - 1; i++) {
    const current = recentStates[i]?.state ?? "";
    const next = recentStates[i + 1]?.state ?? "";

    // Count any transition between build states (both directions)
    const isBuildTransition =
      (current === "build.implement" && next === "build.validate") ||
      (current === "build.validate" && next === "build.implement");

    if (isBuildTransition) {
      oscillations++;
    }
  }

  return oscillations;
}

/**
 * Check if error counts show progress
 *
 * Error progress is defined as having fewer errors than previous iterations.
 * This is a simplified check - in production, you'd track error history.
 *
 * @param errorCounts - Current error counts by type
 * @returns True if errors are decreasing
 */
function isErrorProgress(errorCounts: Record<string, number>): boolean {
  const totalErrors = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);

  // If we have errors but they're low, consider it progress
  // In production, track error history to detect stagnation
  return totalErrors < 10;
}
