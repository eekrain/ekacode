/**
 * Core Stores Export
 *
 * Exports factory functions only - NO singleton instances.
 * Stores must be created within providers for SSR safety and test isolation.
 *
 * Phase 1: Fixed singleton anti-pattern (R1)
 */

export * from "./message-store";
export * from "./part-store";
export * from "./permission-store";
export * from "./question-store";
export * from "./session-store";

// Export factory functions for creating stores
export { createEmptyMessageState, createMessageStore } from "./message-store";
export { createEmptyPartState, createPartStore } from "./part-store";
export { createEmptyPermissionState, createPermissionStore } from "./permission-store";
export { createEmptyQuestionState, createQuestionStore } from "./question-store";
export { createEmptySessionState, createSessionStore } from "./session-store";

// Provider-scoped hooks are in state/providers/store-provider.tsx
// DO NOT create singleton instances here - violates SSR safety and test isolation
