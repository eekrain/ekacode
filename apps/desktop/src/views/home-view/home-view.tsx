import type { RecentProject, WorkspaceState } from "@/chat/types";
import { useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { CloneDialog } from "./components/clone-dialog";
import { WelcomeScreen } from "./components/welcome-screen";

// Simple ID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function HomeView() {
  const navigate = useNavigate();
  const [recentProjects, setRecentProjects] = createSignal<RecentProject[]>([]);
  const [_isDark, _setIsDark] = createSignal(false);
  const [isCloneOpen, setIsCloneOpen] = createSignal(false);

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
    const updated = [project, ...recentProjects().filter(p => p.id !== projectId)].slice(0, 10); // Keep only 10 most recent

    setRecentProjects(updated);
    localStorage.setItem("ekacode:recent-projects", JSON.stringify(updated));

    return projectId;
  };

  const handleOpenFolder = async () => {
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

  const handleCloneFromUrl = () => {
    setIsCloneOpen(true);
  };

  const handleClone = async (url: string, branch: string) => {
    try {
      const clonedPath = await window.ekacodeAPI.workspace.clone({ url, branch });

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

  const handleRemoveProject = (project: RecentProject) => {
    const updated = recentProjects().filter(p => p.id !== project.id);
    setRecentProjects(updated);
    localStorage.setItem("ekacode:recent-projects", JSON.stringify(updated));
  };

  const handleOpenSettings = () => {
    navigate("/settings");
  };

  const handleOpenDocs = async () => {
    // Open documentation in external browser
    await window.ekacodeAPI.shell.openExternal("https://docs.ekacode.dev");
  };

  return (
    <>
      <WelcomeScreen
        recentProjects={recentProjects()}
        onOpenFolder={handleOpenFolder}
        onCloneFromUrl={handleCloneFromUrl}
        onOpenProject={handleOpenProject}
        onRemoveProject={handleRemoveProject}
        onOpenSettings={handleOpenSettings}
        onOpenDocs={handleOpenDocs}
      />
      <CloneDialog
        isOpen={isCloneOpen()}
        onClose={() => setIsCloneOpen(false)}
        onClone={handleClone}
      />
    </>
  );
}
