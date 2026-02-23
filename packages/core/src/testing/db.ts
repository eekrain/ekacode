/**
 * Core Test DB Bridge
 *
 * Core-owned adapter for DB test helpers.
 * Provides a thin abstraction over the shared server DB,
 * allowing core tests to use @/testing/db instead of external dependencies.
 */

import type {
  Message,
  NewTask,
  NewWorkingMemory,
  ObservationalMemory,
  Reflection,
  Task,
  TaskDependency,
  WorkingMemory,
} from "@sakti-code/shared/core-server-bridge";
import * as dbModule from "../../../server/db/index.ts";

function ensureBridgeBindings(): void {
  dbModule.getDb();
}

export async function getDb() {
  ensureBridgeBindings();
  return dbModule.getDb();
}

export function closeDb(): void {
  dbModule.closeDb();
}

export const sessions = dbModule.sessions;
export const tasks = dbModule.tasks;
export const taskDependencies = dbModule.taskDependencies;
export const taskMessages = dbModule.taskMessages;
export const threads = dbModule.threads;
export const messages = dbModule.messages;
export const workingMemory = dbModule.workingMemory;
export const reflections = dbModule.reflections;
export const observationalMemory = dbModule.observationalMemory;
export const toolSessions = dbModule.toolSessions;

export type {
  Message,
  NewTask,
  NewWorkingMemory,
  ObservationalMemory,
  Reflection,
  Task,
  TaskDependency,
  WorkingMemory,
} from "@sakti-code/shared/core-server-bridge";
