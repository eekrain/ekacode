/**
 * Command API Routes
 *
 * GET /api/commands - List available commands
 */

import { Hono } from "hono";
import type { Env } from "../index";

const commandRouter = new Hono<Env>();

const defaultCommands = [
  {
    id: "session.new",
    name: "New Session",
    description: "Start a new session",
    requiresApproval: false,
    category: "session",
    enabled: true,
  },
  {
    id: "session.undo",
    name: "Undo",
    description: "Undo last action",
    requiresApproval: false,
    category: "session",
    enabled: true,
  },
  {
    id: "session.redo",
    name: "Redo",
    description: "Redo last undone action",
    requiresApproval: false,
    category: "session",
    enabled: true,
  },
  {
    id: "session.compact",
    name: "Compact",
    description: "Compact session history",
    requiresApproval: false,
    category: "session",
    enabled: true,
  },
  {
    id: "session.fork",
    name: "Fork",
    description: "Fork current session",
    requiresApproval: false,
    category: "session",
    enabled: true,
  },
  {
    id: "session.share",
    name: "Share",
    description: "Share session",
    requiresApproval: false,
    category: "session",
    enabled: true,
  },
  {
    id: "terminal.new",
    name: "New Terminal",
    description: "Open new terminal",
    requiresApproval: true,
    category: "terminal",
    enabled: true,
  },
  {
    id: "terminal.toggle",
    name: "Toggle Terminal",
    description: "Toggle terminal visibility",
    requiresApproval: false,
    category: "terminal",
    enabled: true,
  },
  {
    id: "model.choose",
    name: "Choose Model",
    description: "Select AI model",
    requiresApproval: false,
    category: "model",
    enabled: true,
  },
  {
    id: "mcp.toggle",
    name: "Toggle MCP",
    description: "Toggle MCP server",
    requiresApproval: false,
    category: "mcp",
    enabled: true,
  },
  {
    id: "agent.cycle",
    name: "Cycle Agent",
    description: "Cycle through agents",
    requiresApproval: false,
    category: "agent",
    enabled: true,
  },
  {
    id: "steps.toggle",
    name: "Toggle Steps",
    description: "Toggle step visibility",
    requiresApproval: false,
    category: "steps",
    enabled: true,
  },
];

/**
 * List available commands
 */
commandRouter.get("/api/commands", async c => {
  const category = c.req.query("category");
  const enabled = c.req.query("enabled");

  let commands = [...defaultCommands];

  if (category) {
    commands = commands.filter(cmd => cmd.category === category);
  }

  if (enabled !== undefined) {
    const isEnabled = enabled === "true";
    commands = commands.filter(cmd => cmd.enabled === isEnabled);
  }

  return c.json({
    commands,
  });
});

export default commandRouter;
