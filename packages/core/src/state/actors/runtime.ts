/**
 * Runtime helpers for agent actors.
 */

import type { AgentRuntime } from "../types";

export function isTestMode(runtime?: AgentRuntime): boolean {
  return Boolean(runtime?.testMode) || process.env.NODE_ENV === "test";
}

export function createAbortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Aborted", "AbortError");
  }
  const error = new Error("Aborted");
  (error as Error & { name: string }).name = "AbortError";
  return error;
}

export function throwIfAborted(runtime?: AgentRuntime): void {
  const signal = runtime?.signal;
  if (signal?.aborted) {
    throw createAbortError();
  }
}
