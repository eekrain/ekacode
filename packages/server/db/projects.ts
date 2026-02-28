/**
 * Project CRUD operations
 *
 * Provides project storage with UUIDv7 identifiers.
 */

import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db, projects } from "./index";

export interface CreateProjectInput {
  name: string;
  path: string;
}

export interface ProjectData {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
}

function mapToProjectData(row: {
  id: string;
  name: string;
  path: string;
  created_at: Date;
}): ProjectData {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
  };
}

export async function createProject(input: CreateProjectInput): Promise<ProjectData> {
  const id = uuidv7();
  const now = new Date();

  const project = {
    id,
    name: input.name,
    path: input.path,
    created_at: now,
  };

  await db.insert(projects).values(project);

  return mapToProjectData(project);
}

export async function getProjectById(id: string): Promise<ProjectData | null> {
  const result = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!result) return null;
  return mapToProjectData(result);
}

export async function getProjectByPath(path: string): Promise<ProjectData | null> {
  const result = await db.select().from(projects).where(eq(projects.path, path)).get();
  if (!result) return null;
  return mapToProjectData(result);
}

export async function listProjects(): Promise<ProjectData[]> {
  const results = await db.select().from(projects).orderBy(projects.created_at).all();
  return results.map(mapToProjectData);
}

export async function getOrCreateProject(input: CreateProjectInput): Promise<ProjectData> {
  const existing = await getProjectByPath(input.path);
  if (existing) {
    return existing;
  }

  const id = uuidv7();
  const now = new Date();
  await db
    .insert(projects)
    .values({
      id,
      name: input.name,
      path: input.path,
      created_at: now,
    })
    .onConflictDoNothing({ target: projects.path });

  const createdOrExisting = await getProjectByPath(input.path);
  if (!createdOrExisting) {
    throw new Error(`Failed to get or create project for path: ${input.path}`);
  }
  return createdOrExisting;
}
