export { chatRoutes } from "./chat.route.js";
export { sessionDataRoutes } from "./session-data.route.js";
export { sessionStatusRoutes } from "./session-status.route.js";

export const migrationCheckpoint = {
  task: "Wire chat module routes",
  status: "implemented-minimally",
} as const;
