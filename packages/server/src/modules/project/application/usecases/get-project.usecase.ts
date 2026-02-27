import { listProjects as dbListProjects } from "../../../../../db/projects.js";

export interface ProjectInfo {
  id: string | undefined;
  name: string | undefined;
  path: string | undefined;
  detectedBy: "packageJson" | "directory" | undefined;
  packageJson: unknown;
}

export async function getProjectInfo(_directory?: string): Promise<ProjectInfo> {
  throw new Error("Use workspace project association instead");
}

export interface ProjectListItem {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface ProjectListResult {
  projects: ProjectListItem[];
}

export async function listProjects(): Promise<ProjectListResult> {
  const projects = await dbListProjects();

  return {
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
