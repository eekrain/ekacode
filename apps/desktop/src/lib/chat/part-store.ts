/**
 * Normalized Part Store
 *
 * Implements OpenCode-style normalized storage for message parts.
 * Parts are stored separately from messages and linked by messageId.
 *
 * Structure:
 * - parts.byId: Record<string, Part> - O(1) part lookup
 * - parts.byMessageId: Record<string, string[]> - messageId -> partId[] mapping
 * - parts.order: Map<string, number> - partId -> sort order within message
 *
 * This enables:
 * - Part-level updates without full message re-renders
 * - Share-style part replacement (update by ID)
 * - Efficient streaming updates
 */

import { createStore, produce, unwrap } from "solid-js/store";
import type { Part, PartType, ReasoningPart, TextPart, ToolCallPart } from "../../types/part";
import { createLogger } from "../logger";

const logger = createLogger("desktop:part-store");

/**
 * Part store state
 */
export interface PartStoreState {
  /** Parts indexed by ID for O(1) lookup */
  byId: Record<string, Part>;
  /** Mapping from messageId to ordered part IDs */
  byMessageId: Record<string, string[]>;
  /** Sort order for each part within its message */
  order: Record<string, number>;
  /** Next order index for each message (auto-increment) */
  nextOrder: Record<string, number>;
}

/**
 * Create a part store with normalized storage
 */
export function createPartStore() {
  const [store, setStore] = createStore<PartStoreState>({
    byId: {},
    byMessageId: {},
    order: {},
    nextOrder: {},
  });

  /**
   * Get the next order index for a message
   */
  const getNextOrder = (messageId: string): number => {
    const current = store.nextOrder[messageId] || 0;
    setStore("nextOrder", messageId, current + 1);
    return current;
  };

  /**
   * Add a new part to the store
   * If part with same ID exists, it will be replaced (Share-style)
   */
  const addPart = (part: Part): void => {
    const clonedPart = structuredClone(part);
    const order = part.order ?? getNextOrder(part.messageId);

    setStore(
      produce(draft => {
        // Add/update the part
        draft.byId[clonedPart.id] = { ...clonedPart, order };
        draft.order[clonedPart.id] = order;

        // Add to message's part list if not already present
        const messageParts = draft.byMessageId[clonedPart.messageId] || [];
        if (!messageParts.includes(clonedPart.id)) {
          draft.byMessageId[clonedPart.messageId] = [...messageParts, clonedPart.id];
        }
      })
    );

    logger.debug("Part added", {
      partId: clonedPart.id,
      messageId: clonedPart.messageId,
      type: clonedPart.type,
      order,
    });
  };

  /**
   * Update an existing part (Share-style: replace in place)
   * Returns true if part was found and updated, false if not found
   */
  const updatePart = (
    partId: string,
    updates: Partial<Omit<Part, "id" | "messageId" | "sessionId">>
  ): boolean => {
    const existingPart = store.byId[partId];
    if (!existingPart) {
      logger.warn("Attempted to update non-existent part", { partId });
      return false;
    }

    setStore(
      "byId",
      partId,
      produce((part: Part) => {
        Object.assign(part, updates);
        part.updatedAt = Date.now();
      })
    );

    logger.debug("Part updated", { partId, type: existingPart.type });
    return true;
  };

  /**
   * Update a part with delta (for streaming text/reasoning)
   * Accumulates delta into content
   */
  const updatePartWithDelta = (partId: string, delta: string): boolean => {
    const existingPart = store.byId[partId];
    if (!existingPart) {
      logger.warn("Attempted to update non-existent part with delta", { partId });
      return false;
    }

    setStore(
      "byId",
      partId,
      produce((part: Part) => {
        if (part.type === "text") {
          (part as TextPart).content.text += delta;
          (part as TextPart).content.status = "streaming";
        } else if (part.type === "reasoning") {
          (part as ReasoningPart).content.text += delta;
          (part as ReasoningPart).content.status = "thinking";
        }
        part.updatedAt = Date.now();
      })
    );

    return true;
  };

  /**
   * Finalize a part (mark as complete)
   */
  const finalizePart = (partId: string, finalContent?: Part["content"]): boolean => {
    const existingPart = store.byId[partId];
    if (!existingPart) {
      logger.warn("Attempted to finalize non-existent part", { partId });
      return false;
    }

    setStore(
      "byId",
      partId,
      produce((part: Part) => {
        if (finalContent !== undefined) {
          part.content = finalContent;
        }

        // Update status based on part type
        if (part.type === "text") {
          (part as TextPart).content.status = "complete";
        } else if (part.type === "reasoning") {
          (part as ReasoningPart).content.status = "complete";
          (part as ReasoningPart).content.durationMs = Date.now() - part.createdAt;
        } else if (part.type === "tool-call") {
          (part as ToolCallPart).content.status = "completed";
        }

        part.updatedAt = Date.now();
      })
    );

    logger.debug("Part finalized", { partId, type: existingPart.type });
    return true;
  };

  /**
   * Remove a part from the store
   */
  const removePart = (partId: string): boolean => {
    const part = store.byId[partId];
    if (!part) {
      return false;
    }

    setStore(
      produce(draft => {
        // Remove from byId
        delete draft.byId[partId];
        delete draft.order[partId];

        // Remove from message's part list
        const messageParts = draft.byMessageId[part.messageId] || [];
        draft.byMessageId[part.messageId] = messageParts.filter(id => id !== partId);
      })
    );

    logger.debug("Part removed", { partId, messageId: part.messageId });
    return true;
  };

  /**
   * Remove all parts for a message
   */
  const removePartsForMessage = (messageId: string): void => {
    const partIds = store.byMessageId[messageId] || [];

    setStore(
      produce(draft => {
        for (const partId of partIds) {
          delete draft.byId[partId];
          delete draft.order[partId];
        }
        delete draft.byMessageId[messageId];
        delete draft.nextOrder[messageId];
      })
    );

    logger.debug("Parts removed for message", { messageId, count: partIds.length });
  };

  /**
   * Get a part by ID
   */
  const getPart = (partId: string): Part | undefined => {
    return store.byId[partId];
  };

  /**
   * Get all parts for a message (sorted by order)
   */
  const getPartsForMessage = (messageId: string): Part[] => {
    const partIds = store.byMessageId[messageId] || [];
    return partIds
      .map(id => store.byId[id])
      .filter((part): part is Part => part !== undefined)
      .sort((a, b) => (store.order[a.id] || 0) - (store.order[b.id] || 0));
  };

  /**
   * Get parts for a message filtered by type
   */
  const getPartsByType = <T extends PartType>(
    messageId: string,
    type: T
  ): Extract<Part, { type: T }>[] => {
    return getPartsForMessage(messageId).filter(
      (part): part is Extract<Part, { type: T }> => part.type === type
    );
  };

  /**
   * Check if a part exists
   */
  const hasPart = (partId: string): boolean => {
    return partId in store.byId;
  };

  /**
   * Get the count of parts for a message
   */
  const getPartCount = (messageId: string): number => {
    return (store.byMessageId[messageId] || []).length;
  };

  /**
   * Clear all parts
   */
  const clear = (): void => {
    setStore({
      byId: {},
      byMessageId: {},
      order: {},
      nextOrder: {},
    });
    logger.debug("Part store cleared");
  };

  /**
   * Export parts for a message (for serialization)
   */
  const exportPartsForMessage = (messageId: string): Part[] => {
    return getPartsForMessage(messageId).map(part => structuredClone(unwrap(part)));
  };

  /**
   * Import parts for a message (for hydration)
   */
  const importParts = (parts: Part[]): void => {
    for (const part of parts) {
      addPart(part);
    }
    logger.debug("Parts imported", { count: parts.length });
  };

  return {
    // State access
    get state() {
      return store;
    },

    // Core operations
    addPart,
    updatePart,
    updatePartWithDelta,
    finalizePart,
    removePart,
    removePartsForMessage,

    // Queries
    getPart,
    getPartsForMessage,
    getPartsByType,
    hasPart,
    getPartCount,

    // Bulk operations
    clear,
    exportPartsForMessage,
    importParts,
  };
}

/**
 * Type for the part store return value
 */
export type PartStore = ReturnType<typeof createPartStore>;
