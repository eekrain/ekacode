import type { ArchivedWorkspace, RecentProject } from "@/core/chat/types";
import { Layers, Plus, Search, Settings } from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { ArchivedWorkspaceItem } from "./archived-workspace-item";
import { EmptyState } from "./empty-state";
import { KeyboardShortcutsFooter } from "./keyboard-shortcuts-footer";
import { ProjectCard } from "./project-card";

interface WorkspaceDashboardProps {
  recentWorkspaces: RecentProject[];
  archivedWorkspaces: ArchivedWorkspace[];
  onOpenWorkspace: (workspace: RecentProject) => void;
  onArchiveWorkspace: (workspace: RecentProject) => void;
  onRestoreWorkspace: (workspace: ArchivedWorkspace) => void;
  onNewWorkspace: () => void;
  onSearch: () => void;
  onSettingsOpen?: () => void;
  isLoading?: boolean;
}

interface ProjectGroup {
  id: string;
  name: string;
  path?: string;
  workspaces: RecentProject[];
}

function groupWorkspacesByProject(workspaces: RecentProject[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();

  for (const ws of workspaces) {
    const projectKey = ws.projectId || "ungrouped";
    const projectName = ws.project?.name || ws.name;
    const projectPath = ws.project?.path;

    if (!groups.has(projectKey)) {
      groups.set(projectKey, {
        id: projectKey,
        name: projectName,
        path: projectPath,
        workspaces: [],
      });
    }

    groups.get(projectKey)!.workspaces.push(ws);
  }

  const grouped = Array.from(groups.values()).map(group => ({
    ...group,
    workspaces: [...group.workspaces].sort(
      (a, b) => b.lastOpened.getTime() - a.lastOpened.getTime()
    ),
  }));

  return grouped.sort((a, b) => {
    const aTime = a.workspaces[0]?.lastOpened.getTime() || 0;
    const bTime = b.workspaces[0]?.lastOpened.getTime() || 0;
    return bTime - aTime;
  });
}

function filterWorkspaces<T extends { name: string; path: string }>(
  workspaces: T[],
  query: string
): T[] {
  if (!query.trim()) return workspaces;
  const lowerQuery = query.toLowerCase();
  return workspaces.filter(
    w => w.name.toLowerCase().includes(lowerQuery) || w.path.toLowerCase().includes(lowerQuery)
  );
}

export function WorkspaceDashboard(props: WorkspaceDashboardProps) {
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredRecent = () => filterWorkspaces(props.recentWorkspaces, searchQuery());
  const filteredArchived = () => filterWorkspaces(props.archivedWorkspaces, searchQuery());
  const groupedProjects = () => groupWorkspacesByProject(filteredRecent());

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      props.onSearch();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      props.onNewWorkspace();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div class="bg-background flex min-h-screen flex-col">
      {/* Main Content */}
      <div class="flex-1 overflow-auto p-6">
        <div class="mx-auto max-w-4xl">
          {/* Main Card Container */}
          <div class="border-border/50 bg-card rounded-2xl border shadow-lg">
            {/* Hero Section */}
            <div class="border-border/50 border-b p-6">
              <div class="flex flex-col gap-6">
                {/* Brand Row */}
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-4">
                    <div class="bg-primary shadow-primary/25 flex h-12 w-12 items-center justify-center rounded-xl shadow-lg">
                      <Layers class="text-primary-foreground h-6 w-6" />
                    </div>
                    <div>
                      <h1 class="text-foreground text-2xl font-bold tracking-tight">Sakti</h1>
                      <p class="text-muted-foreground text-sm">
                        Privacy-focused local AI coding agent
                      </p>
                    </div>
                  </div>
                  <button
                    class="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-all duration-200"
                    aria-label="Settings"
                    onClick={() => props.onSettingsOpen?.()}
                  >
                    <Settings class="h-5 w-5" />
                  </button>
                </div>

                {/* Search Row */}
                <div class="relative">
                  <div class="text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2">
                    <Search class="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    class="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-xl border py-3.5 pl-12 pr-24 text-base outline-none transition-all duration-200 focus:ring-2"
                    placeholder="Search workspaces..."
                    value={searchQuery()}
                    onInput={e => setSearchQuery(e.currentTarget.value)}
                    data-test="search-input"
                  />
                  <div class="text-muted-foreground bg-muted absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium">
                    <kbd class="bg-muted-foreground/20 rounded px-1.5 py-0.5 font-sans">⌘</kbd>
                    <kbd class="bg-muted-foreground/20 rounded px-1.5 py-0.5 font-sans">F</kbd>
                  </div>
                </div>

                {/* Actions Row */}
                <div class="flex items-center gap-3">
                  <button
                    class="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 hover:shadow-primary/30 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg transition-all duration-200 hover:shadow-xl active:scale-[0.98]"
                    onClick={() => props.onNewWorkspace()}
                  >
                    <Plus class="h-4 w-4" />
                    New Workspace
                  </button>
                  <span class="text-muted-foreground text-xs">or press</span>
                  <kbd class="border-border bg-muted text-muted-foreground rounded border px-2 py-1 text-xs font-medium">
                    ⌘N
                  </kbd>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div class="flex flex-col">
              {/* Projects Grid */}
              <div class="border-border/50 border-b p-4">
                <div class="mb-3 flex items-center justify-between">
                  <h2 class="text-foreground text-sm font-semibold">Projects</h2>
                  <span class="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {groupedProjects().length}
                  </span>
                </div>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Show
                    when={groupedProjects().length > 0}
                    fallback={
                      <div class="col-span-full">
                        <EmptyState
                          icon="📂"
                          title="No recent workspaces"
                          subtitle="Open a workspace to get started"
                        />
                      </div>
                    }
                  >
                    <For each={groupedProjects()}>
                      {project => (
                        <ProjectCard
                          project={project}
                          workspaces={project.workspaces}
                          onOpenProject={() => {
                            const firstWs = project.workspaces[0];
                            if (firstWs) props.onOpenWorkspace(firstWs);
                          }}
                          onOpenWorkspace={props.onOpenWorkspace}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              </div>

              {/* Archived */}
              <div class="p-4">
                <div class="mb-3 flex items-center justify-between">
                  <h2 class="text-foreground text-sm font-semibold">Archived</h2>
                  <span class="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {filteredArchived().length}
                  </span>
                </div>

                <div class="space-y-2">
                  <Show
                    when={filteredArchived().length > 0}
                    fallback={
                      <EmptyState
                        icon="📦"
                        title="No archived workspaces"
                        subtitle="Archived workspaces will appear here"
                      />
                    }
                  >
                    <For each={filteredArchived()}>
                      {workspace => (
                        <ArchivedWorkspaceItem
                          workspace={workspace}
                          onRestore={props.onRestoreWorkspace}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div class="mt-6 flex justify-center">
            <KeyboardShortcutsFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
