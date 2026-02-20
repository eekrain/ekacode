import type { ArchivedWorkspace, RecentProject, WorkspaceState } from "@/core/chat/types";
import { useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { CloneDialog } from "./components/clone-dialog";
import { NewWorkspaceDialog } from "./components/new-workspace-dialog";
import { WorkspaceDashboard } from "./components/workspace-dashboard";

// Simple ID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function HomeView() {
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = createSignal<RecentProject[]>([]);
  const [archivedProjects, setArchivedProjects] = createSignal<ArchivedWorkspace[]>([]);
  const [_isDark, _setIsDark] = createSignal(false);
  const [isCloneOpen, setIsCloneOpen] = createSignal(false);
  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = createSignal(false);

  onMount(() => {
    // Load recent projects from localStorage
    const stored = localStorage.getItem("ekacode:recent-projects");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Array<{
          id: string;
          name: string;
          path: string;
          lastOpened: string;
        }>;
        setRecentProjects(
          parsed.map(p => ({
            ...p,
            lastOpened: new Date(p.lastOpened),
          }))
        );
      } catch {
        setRecentProjects([]);
      }
    }

    // Check dark mode preference
    const darkMode = localStorage.getItem("ekacode:theme") === "dark";
    _setIsDark(darkMode);
    if (darkMode) {
      document.documentElement.classList.add("dark");
    }
  });

  const addRecentProject = (path: string, name?: string) => {
    // Extract project name from path if not provided
    const projectName = name || path.split(/[/\\]/).filter(Boolean).pop() || path;

    // Check if project already exists
    const existing = recentProjects().find(p => p.path === path);
    const projectId = existing?.id || generateId();

    // Create or update project
    const project: RecentProject = {
      id: projectId,
      name: projectName,
      path,
      lastOpened: new Date(),
    };

    // Update recent projects list (most recent first)
    const updated = [project, ...recentProjects().filter(p => p.id !== projectId)].slice(0, 10);

    setRecentProjects(updated);
    localStorage.setItem("ekacode:recent-projects", JSON.stringify(updated));

    return projectId;
  };

  const _handleOpenFolder = async () => {
    const selectedPath = await window.ekacodeAPI.dialog.openDirectory();
    if (selectedPath) {
      const projectId = addRecentProject(selectedPath);

      // Store workspace state in sessionStorage
      const workspaceState: WorkspaceState = {
        projectId,
        path: selectedPath,
        name: selectedPath.split(/[/\\]/).filter(Boolean).pop() || selectedPath,
      };
      sessionStorage.setItem(`workspace:${projectId}`, JSON.stringify(workspaceState));

      // Navigate to workspace
      navigate(`/workspace/${projectId}`);
    }
  };

  const _handleCloneFromUrl = () => {
    setIsCloneOpen(true);
  };

  const handleClone = async (url: string, branch: string) => {
    try {
      const clonedPath = await window.ekacodeAPI.workspace.clone({
        url,
        branch,
        targetDir: "",
      });

      // Add to recent projects
      const projectId = addRecentProject(clonedPath);

      // Store workspace state
      const workspaceState: WorkspaceState = {
        projectId,
        path: clonedPath,
        name: clonedPath.split(/[/\\]/).filter(Boolean).pop() || clonedPath,
      };
      sessionStorage.setItem(`workspace:${projectId}`, JSON.stringify(workspaceState));

      // Close dialog and navigate
      setIsCloneOpen(false);

      // Small delay for smooth UX
      setTimeout(() => {
        navigate(`/workspace/${projectId}`);
      }, 100);
    } catch (error) {
      // Error is handled in CloneDialog
      throw error;
    }
  };

  const handleOpenProject = (project: RecentProject) => {
    // Update last opened time
    const updated = recentProjects().map(p =>
      p.id === project.id ? { ...p, lastOpened: new Date() } : p
    );
    // Sort by most recent
    const sorted = [
      updated.find(p => p.id === project.id)!,
      ...updated.filter(p => p.id !== project.id),
    ];
    setRecentProjects(sorted);
    localStorage.setItem("ekacode:recent-projects", JSON.stringify(sorted));

    // Store workspace state in sessionStorage
    const workspaceState: WorkspaceState = {
      projectId: project.id,
      path: project.path,
      name: project.name,
    };
    sessionStorage.setItem(`workspace:${project.id}`, JSON.stringify(workspaceState));

    // Navigate to workspace
    navigate(`/workspace/${project.id}`);
  };

  const _handleRemoveProject = (project: RecentProject) => {
    const updated = recentProjects().filter(p => p.id !== project.id);
    setRecentProjects(updated);
    localStorage.setItem("ekacode:recent-projects", JSON.stringify(updated));
  };

  const _handleOpenSettings = () => {
    navigate("/settings");
  };

  const _handleOpenDocs = async () => {
    // Open documentation in external browser
    await window.ekacodeAPI.shell.openExternal("https://docs.ekacode.dev");
  };

  const handleArchiveWorkspace = (project: RecentProject) => {
    const archived: ArchivedWorkspace = {
      id: project.id,
      name: project.name,
      path: project.path,
      archivedAt: new Date(),
      isMerged: false,
      baseBranch: project.gitStatus?.baseBranch || "main",
      repoPath: project.path,
    };
    const updated = [...archivedProjects(), archived];
    setArchivedProjects(updated);
    localStorage.setItem("ekacode:archived-projects", JSON.stringify(updated));

    const filtered = recentProjects().filter(p => p.id !== project.id);
    setRecentProjects(filtered);
    localStorage.setItem("ekacode:recent-projects", JSON.stringify(filtered));
  };

  const handleRestoreWorkspace = (workspace: ArchivedWorkspace) => {
    const recent: RecentProject = {
      id: workspace.id,
      name: workspace.name,
      path: workspace.path,
      lastOpened: new Date(),
    };
    const updated = [recent, ...recentProjects()];
    setRecentProjects(updated);
    localStorage.setItem("ekacode:recent-projects", JSON.stringify(updated));

    const filtered = archivedProjects().filter(w => w.id !== workspace.id);
    setArchivedProjects(filtered);
    localStorage.setItem("ekacode:archived-projects", JSON.stringify(filtered));
  };

  const handleNewWorkspace = () => {
    setIsNewWorkspaceOpen(true);
  };

  const handleCreateWorkspace = async (worktreePath: string, worktreeName: string) => {
    // Add to recent projects (worktreePath is the actual workspace path)
    const projectId = addRecentProject(worktreePath, worktreeName);

    // Store workspace state in sessionStorage
    const workspaceState: WorkspaceState = {
      projectId,
      path: worktreePath,
      name: worktreeName,
    };
    sessionStorage.setItem(`workspace:${projectId}`, JSON.stringify(workspaceState));

    // Close dialog and navigate
    setIsNewWorkspaceOpen(false);

    // Small delay for smooth UX
    setTimeout(() => {
      navigate(`/workspace/${projectId}`);
    }, 100);
  };

  const handleSearch = () => {
    const searchInput = document.querySelector('[data-test="search-input"]') as HTMLInputElement;
    searchInput?.focus();
  };

  return (
    <>
      <WorkspaceDashboard
        recentWorkspaces={recentProjects()}
        archivedWorkspaces={archivedProjects()}
        onOpenWorkspace={handleOpenProject}
        onArchiveWorkspace={handleArchiveWorkspace}
        onRestoreWorkspace={handleRestoreWorkspace}
        onNewWorkspace={handleNewWorkspace}
        onSearch={handleSearch}
      />
      <CloneDialog
        isOpen={isCloneOpen()}
        onClose={() => setIsCloneOpen(false)}
        onClone={handleClone}
      />
      <NewWorkspaceDialog
        isOpen={isNewWorkspaceOpen()}
        onClose={() => setIsNewWorkspaceOpen(false)}
        onCreate={handleCreateWorkspace}
      />
    </>
  );
}
