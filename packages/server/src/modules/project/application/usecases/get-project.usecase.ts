import { listProjects as dbListProjects } from "../../../../../db/projects.js";
import { detectProject } from "../../../workspace/infrastructure/detect-project.js";

export interface ProjectInfo {
  id: string | undefined;
  name: string | undefined;
  path: string | undefined;
  detectedBy: "packageJson" | "directory" | undefined;
  packageJson: unknown;
}

export async function getProjectInfo(directory?: string): Promise<ProjectInfo> {
  if (!directory) {
    throw new Error("Directory parameter required");
  }

  const project = detectProject(directory);

  return {
    id: undefined,
    name: project.name,
    path: project.path,
    detectedBy: "directory",
    packageJson: null,
  };
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
