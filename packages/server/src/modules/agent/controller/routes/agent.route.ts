import { listAgents } from "@sakti-code/core";
import { Hono } from "hono";

type Env = {
  Variables: {
    requestId: string;
    startTime: number;
  };
};

const app = new Hono<Env>();

app.get("/api/agents", async c => {
  const nameMap: Record<string, string> = {
    build: "Build Agent",
    explore: "Explore Agent",
    plan: "Plan Agent",
  };

  return c.json({
    agents: listAgents().map(agent => ({
      id: agent.name,
      name: nameMap[agent.name] ?? agent.name,
    })),
  });
});

export const agentRoutes = app;
