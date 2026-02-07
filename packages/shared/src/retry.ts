/**
 * Retry Utilities
 *
 * Provides retry logic for transient network failures and API calls.
 * Includes exponential backoff and customizable retry conditions.
 *
 * Based on opencode packages/util/src/retry.ts
 */

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  attempts?: number;
  /** Initial delay in milliseconds (default: 500) */
  delay?: number;
  /** Exponential backoff factor (default: 2) */
  factor?: number;
  /** Maximum delay between attempts in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Custom retry condition function */
  retryIf?: (error: unknown) => boolean;
}

/**
 * Transient error messages that should trigger a retry
 */
const TRANSIENT_MESSAGES = [
  "load failed",
  "network connection was lost",
  "network request failed",
  "failed to fetch",
  "econnreset",
  "econnrefused",
  "etimedout",
  "socket hang up",
  "timeout",
  "temporary failure",
  "service unavailable",
  "gateway timeout",
  "bad gateway",
  "connection reset",
  "connection refused",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ENOTFOUND",
  "503",
  "502",
  "504",
];

/**
 * Check if an error is a transient error that should be retried
 *
 * @param error - The error to check
 * @returns True if the error is transient
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return TRANSIENT_MESSAGES.some(m => message.toLowerCase().includes(m.toLowerCase()));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry options
 * @returns The result of the function
 * @throws The last error if all attempts fail
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => sdk.project.list(),
 *   { attempts: 3, delay: 500, factor: 2 }
 * );
 * ```
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    attempts = 3,
    delay = 500,
    factor = 2,
    maxDelay = 10000,
    retryIf = isTransientError,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === attempts - 1 || !retryIf(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const wait = Math.min(delay * Math.pow(factor, attempt), maxDelay);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }

  throw lastError;
}

/**
 * Retry multiple functions in parallel with individual retry logic
 *
 * @param fns - Array of functions to retry
 * @param options - Retry options
 * @returns Array of results or errors
 */
export async function retryAll<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<T | Error>> {
  return Promise.all(
    fns.map(async fn => {
      try {
        return await retry(fn, options);
      } catch (error) {
        return error as Error;
      }
    })
  );
}

/**
 * Retry with a timeout
 *
 * @param fn - The async function to retry
 * @param timeout - Timeout in milliseconds
 * @param options - Retry options
 * @returns The result of the function
 * @throws TimeoutError if timeout is exceeded
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeout: number,
  options: RetryOptions = {}
): Promise<T> {
  return Promise.race([
    retry(fn, options),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
    ),
  ]);
}

/**
 * Create a retriable function with pre-configured options
 *
 * @param fn - The async function to make retriable
 * @param options - Retry options
 * @returns A retriable function
 */
export function makeRetriable<T>(fn: () => Promise<T>, options: RetryOptions = {}) {
  return () => retry(fn, options);
}
