/**
 * Bus Event Definition System
 *
 * Opencode-style event registry with Zod schemas.
 * Provides a unified event format: { type, properties }
 */

import { z } from "zod";

export type BusEventDefinition = ReturnType<typeof defineBusEvent>;

const registry = new Map<string, BusEventDefinition>();

/**
 * Define a new event type with Zod schema validation
 * @param type - Event type string (e.g., "message.updated")
 * @param properties - Zod schema for event properties
 * @returns Event definition object
 */
export function defineBusEvent<Type extends string, Properties extends z.ZodType>(
  type: Type,
  properties: Properties
) {
  const result = {
    type,
    properties,
  };
  registry.set(type, result);
  return result;
}

/**
 * Get all registered event types
 */
export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}

/**
 * Check if an event type is registered
 */
export function isRegistered(type: string): boolean {
  return registry.has(type);
}
