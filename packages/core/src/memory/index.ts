/**
 * Memory System Index
 *
 * Phase 1 Memory System exports.
 */

export {
  taskStorage,
  type BlockedStatus,
  type CreateTaskInput,
  type ListTasksOptions,
  type UpdateTaskInput,
} from "./task/storage";
export { executeTaskMutate, taskMutateTool } from "./task/task-mutate";
export { executeTaskQuery, taskQueryTool } from "./task/task-query";

export {
  messageStorage,
  type CreateMessageInput,
  type ListMessagesOptions,
} from "./message/storage";

export { executeMemorySearch, memorySearchTool, type SearchResult } from "./search";
