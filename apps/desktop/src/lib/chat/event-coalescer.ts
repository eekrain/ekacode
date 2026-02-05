/**
 * Event Stream Coalescing
 *
 * Implements OpenCode-style event coalescing for smooth UI updates.
 * Batches multiple events for the same part into a single update per animation frame.
 *
 * Key features:
 * - Coalesce by messageId:partId key
 * - Batch updates per animation frame (16ms)
 * - Accumulate deltas for streaming content
 * - Emit coalesced batches to store
 *
 * Usage:
 * ```typescript
 * const coalescer = createEventCoalescer({
 *   onBatch: (batch) => {
 *     // Apply batch to store
 *     batch.parts.forEach((part) => partStore.updatePart(part.id, part));
 *     batch.deltas.forEach((delta, partId) => partStore.updatePartWithDelta(partId, delta));
 *   }
 * });
 *
 * // Queue events during streaming
 * coalescer.queue({ type: "part.updated", part: { id: "p1", ... }, delta: "Hello " });
 * coalescer.queue({ type: "part.updated", part: { id: "p1", ... }, delta: "World" });
 *
 * // Events are automatically batched and emitted on next animation frame
 * ```
 */

import type { Part } from "../../types/part";
import { createLogger } from "../logger";

const logger = createLogger("desktop:event-coalescer");

/**
 * Event types that can be coalesced
 */
export type CoalescableEvent =
  | { type: "part.created"; part: Part }
  | { type: "part.updated"; part: Part; delta?: string }
  | { type: "part.removed"; partId: string; messageId: string }
  | {
      type: "message.created";
      message: { id: string; role: string; sessionId: string; createdAt: number };
    }
  | { type: "message.updated"; message: { id: string; metadata?: Record<string, unknown> } }
  | { type: "message.removed"; messageId: string };

/**
 * Coalesced batch of updates
 */
export interface CoalescedBatch {
  /** Parts to create/update (by ID) */
  parts: Map<string, Part>;
  /** Accumulated deltas by part ID */
  deltas: Map<string, string>;
  /** Parts to remove */
  removedParts: Set<string>;
  /** Messages to create/update */
  messages: Map<
    string,
    {
      id: string;
      role?: string;
      sessionId?: string;
      createdAt?: number;
      metadata?: Record<string, unknown>;
    }
  >;
  /** Messages to remove */
  removedMessages: Set<string>;
}

/**
 * Options for event coalescer
 */
export interface EventCoalescerOptions {
  /** Called when a batch is ready to be applied */
  onBatch: (batch: CoalescedBatch) => void;
  /** Batch window in ms (default: 16ms for 60fps) */
  batchWindowMs?: number;
  /** Maximum batch size before forcing flush */
  maxBatchSize?: number;
}

/**
 * Create an event coalescer
 */
export function createEventCoalescer(options: EventCoalescerOptions) {
  const { onBatch, batchWindowMs = 16, maxBatchSize = 100 } = options;

  // Current batch being built
  let currentBatch: CoalescedBatch = {
    parts: new Map(),
    deltas: new Map(),
    removedParts: new Set(),
    messages: new Map(),
    removedMessages: new Set(),
  };

  // Timeout for batch flush
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;

  // Track if we're currently processing a batch (to prevent re-entrancy)
  let isProcessing = false;

  /**
   * Get the coalescing key for an event
   */
  const _getCoalescingKey = (event: CoalescableEvent): string => {
    switch (event.type) {
      case "part.created":
      case "part.updated":
        return `${event.part.messageId}:${event.part.id}`;
      case "part.removed":
        return `${event.messageId}:${event.partId}`;
      case "message.created":
      case "message.updated":
        return `msg:${event.message.id}`;
      case "message.removed":
        return `msg:${event.messageId}`;
      default:
        return "unknown";
    }
  };

  /**
   * Queue an event for coalescing
   */
  const queue = (event: CoalescableEvent): void => {
    if (isProcessing) {
      // If we're currently processing, queue directly to avoid re-entrancy
      processEvent(event);
      return;
    }

    // Add to batch
    processEvent(event);

    // Schedule flush if not already scheduled
    if (!flushTimeout) {
      flushTimeout = setTimeout(flush, batchWindowMs);
    }

    // Force flush if batch is getting large
    const totalSize =
      currentBatch.parts.size + currentBatch.deltas.size + currentBatch.messages.size;
    if (totalSize >= maxBatchSize) {
      flush();
    }
  };

  /**
   * Process a single event into the current batch
   */
  const processEvent = (event: CoalescableEvent): void => {
    switch (event.type) {
      case "part.created":
        // Add or replace part
        currentBatch.parts.set(event.part.id, event.part);
        // Remove from removed set if it was previously removed
        currentBatch.removedParts.delete(event.part.id);
        break;

      case "part.updated":
        // Update part (replace in place)
        currentBatch.parts.set(event.part.id, event.part);
        // Accumulate delta if provided
        if (event.delta) {
          const existingDelta = currentBatch.deltas.get(event.part.id) || "";
          currentBatch.deltas.set(event.part.id, existingDelta + event.delta);
        }
        break;

      case "part.removed":
        // Mark for removal
        currentBatch.removedParts.add(event.partId);
        // Remove from parts/deltas if present
        currentBatch.parts.delete(event.partId);
        currentBatch.deltas.delete(event.partId);
        break;

      case "message.created":
        currentBatch.messages.set(event.message.id, event.message);
        currentBatch.removedMessages.delete(event.message.id);
        break;

      case "message.updated":
        // Merge with existing message data
        const existingMsg = currentBatch.messages.get(event.message.id);
        currentBatch.messages.set(event.message.id, {
          ...existingMsg,
          ...event.message,
          id: event.message.id,
        });
        break;

      case "message.removed":
        currentBatch.removedMessages.add(event.messageId);
        currentBatch.messages.delete(event.messageId);
        break;
    }
  };

  /**
   * Flush the current batch
   */
  const flush = (): void => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }

    // Skip if batch is empty
    if (
      currentBatch.parts.size === 0 &&
      currentBatch.deltas.size === 0 &&
      currentBatch.messages.size === 0 &&
      currentBatch.removedParts.size === 0 &&
      currentBatch.removedMessages.size === 0
    ) {
      return;
    }

    // Capture batch and reset
    const batch = currentBatch;
    currentBatch = {
      parts: new Map(),
      deltas: new Map(),
      removedParts: new Set(),
      messages: new Map(),
      removedMessages: new Set(),
    };

    // Process batch
    isProcessing = true;
    try {
      logger.debug("Flushing coalesced batch", {
        parts: batch.parts.size,
        deltas: batch.deltas.size,
        messages: batch.messages.size,
        removedParts: batch.removedParts.size,
        removedMessages: batch.removedMessages.size,
      });

      onBatch(batch);
    } catch (error) {
      logger.error("Error processing coalesced batch", error as Error);
    } finally {
      isProcessing = false;
    }
  };

  /**
   * Force immediate flush
   */
  const forceFlush = (): void => {
    flush();
  };

  /**
   * Clear pending events without flushing
   */
  const clear = (): void => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    currentBatch = {
      parts: new Map(),
      deltas: new Map(),
      removedParts: new Set(),
      messages: new Map(),
      removedMessages: new Set(),
    };
    logger.debug("Coalescer cleared");
  };

  /**
   * Check if there are pending events
   */
  const hasPending = (): boolean => {
    return (
      currentBatch.parts.size > 0 ||
      currentBatch.deltas.size > 0 ||
      currentBatch.messages.size > 0 ||
      currentBatch.removedParts.size > 0 ||
      currentBatch.removedMessages.size > 0
    );
  };

  return {
    queue,
    flush: forceFlush,
    clear,
    hasPending,
  };
}

/**
 * Type for the event coalescer return value
 */
export type EventCoalescer = ReturnType<typeof createEventCoalescer>;
