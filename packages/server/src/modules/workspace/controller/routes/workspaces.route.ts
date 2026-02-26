import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../../index.js";
import {
  archiveWorkspace as archiveWorkspaceUseCase,
  createWorkspace as createWorkspaceUseCase,
  deleteWorkspace as deleteWorkspaceUseCase,
  getWorkspaceById as getWorkspaceByIdUseCase,
  getWorkspaceByPath as getWorkspaceByPathUseCase,
  listWorkspaces as listWorkspacesUseCase,
  restoreWorkspace as restoreWorkspaceUseCase,
  touchWorkspace as touchWorkspaceUseCase,
  updateWorkspace as updateWorkspaceUseCase,
} from "../../application/usecases/list-workspaces.usecase.js";

const workspacesApp = new Hono<Env>();

function serializeWorkspace(ws: Awaited<ReturnType<typeof getWorkspaceByIdUseCase>>) {
  if (!ws) return null;
  return {
    id: ws.id,
    path: ws.path,
    name: ws.name,
    status: ws.status,
    baseBranch: ws.baseBranch,
    repoPath: ws.repoPath,
    isMerged: ws.isMerged,
    archivedAt: ws.archivedAt?.toISOString() ?? null,
    createdAt: ws.createdAt.toISOString(),
    lastOpenedAt: ws.lastOpenedAt.toISOString(),
  };
}

const createWorkspaceSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().optional(),
});

const archiveWorkspaceSchema = z.object({
  baseBranch: z.string().optional(),
  repoPath: z.string().optional(),
  isMerged: z.boolean().optional(),
});

workspacesApp.get("/api/workspaces/by-path", async c => {
  const path = c.req.query("path");

  if (!path) {
    return c.json({ error: "Path parameter required" }, 400);
  }

  const workspace = await getWorkspaceByPathUseCase(path);
  if (!workspace) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  return c.json({ workspace: serializeWorkspace(workspace) });
});

workspacesApp.get("/api/workspaces", async c => {
  const activeWorkspaces = await listWorkspacesUseCase({ status: "active" });
  return c.json({ workspaces: activeWorkspaces.map(serializeWorkspace) });
});

workspacesApp.get("/api/workspaces/archived", async c => {
  const archivedWorkspaces = await listWorkspacesUseCase({ status: "archived" });
  return c.json({ workspaces: archivedWorkspaces.map(serializeWorkspace) });
});

workspacesApp.get("/api/workspaces/:id", async c => {
  const { id } = c.req.param();

  const workspace = await getWorkspaceByIdUseCase(id);
  if (!workspace) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  return c.json({ workspace: serializeWorkspace(workspace) });
});

workspacesApp.post("/api/workspaces", async c => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error }, 400);
  }

  const { path, name } = parsed.data;

  const result = await createWorkspaceUseCase({ path, name });
  return c.json(
    { workspace: serializeWorkspace(result.workspace), existing: result.existing },
    result.existing ? 200 : 201
  );
});

workspacesApp.put("/api/workspaces/:id", async c => {
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateWorkspaceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const existing = await getWorkspaceByIdUseCase(id);
  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const updateData: { name?: string } = {};
  if (parsed.data.name) {
    updateData.name = parsed.data.name;
  }

  const updated = await updateWorkspaceUseCase(id, updateData);

  return c.json({ workspace: serializeWorkspace(updated) });
});

workspacesApp.put("/api/workspaces/:id/archive", async c => {
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const parsed = archiveWorkspaceSchema.safeParse(body);

  const existing = await getWorkspaceByIdUseCase(id);
  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const updated = await archiveWorkspaceUseCase(id, parsed.success ? parsed.data : undefined);

  return c.json({ workspace: serializeWorkspace(updated) });
});

workspacesApp.put("/api/workspaces/:id/restore", async c => {
  const { id } = c.req.param();

  const existing = await getWorkspaceByIdUseCase(id);
  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const updated = await restoreWorkspaceUseCase(id);

  return c.json({ workspace: serializeWorkspace(updated) });
});

workspacesApp.put("/api/workspaces/:id/touch", async c => {
  const { id } = c.req.param();

  const existing = await getWorkspaceByIdUseCase(id);
  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const updated = await touchWorkspaceUseCase(id);

  return c.json({ workspace: serializeWorkspace(updated) });
});

workspacesApp.delete("/api/workspaces/:id", async c => {
  const { id } = c.req.param();

  const existing = await getWorkspaceByIdUseCase(id);
  if (!existing) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  await deleteWorkspaceUseCase(id);

  return c.json({ success: true });
});

export { workspacesApp };
