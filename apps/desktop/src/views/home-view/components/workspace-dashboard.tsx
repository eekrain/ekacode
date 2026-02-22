import type { ArchivedWorkspace, RecentProject } from "@/core/chat/types";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { ArchivedWorkspaceItem } from "./archived-workspace-item";
import { EmptyState } from "./empty-state";
import { KeyboardShortcutsFooter } from "./keyboard-shortcuts-footer";
import { WorkspaceCard } from "./workspace-card";

type Column = "recent" | "archived";

// Icons as components
const LogoIcon = () => (
  <svg class="text-primary-foreground h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    class="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22-.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1-2 0l.43-.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2-2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1-1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1-1-1.74l-.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1 1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SearchIcon = () => (
  <svg
    class="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

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
  const [isSearchActive, setIsSearchActive] = createSignal(false);
  const [focusedColumn, setFocusedColumn] = createSignal<Column>("recent");
  const [focusedIndex, setFocusedIndex] = createSignal(0);

  const filteredRecent = () => filterWorkspaces(props.recentWorkspaces, searchQuery());
  const filteredArchived = () => filterWorkspaces(props.archivedWorkspaces, searchQuery());

  const isFocused = (column: Column, index: number): boolean => {
    return focusedColumn() === column && focusedIndex() === index;
  };

  const navigateDown = () => {
    const maxLength =
      focusedColumn() === "recent" ? filteredRecent().length : filteredArchived().length;
    const maxIndex = maxLength - 1;
    setFocusedIndex(prev => Math.min(prev + 1, maxIndex));
  };

  const navigateUp = () => {
    setFocusedIndex(prev => Math.max(prev - 1, 0));
  };

  const navigateRight = () => {
    if (focusedColumn() === "recent") {
      setFocusedColumn("archived");
      setFocusedIndex(0);
    }
  };

  const navigateLeft = () => {
    if (focusedColumn() === "archived") {
      setFocusedColumn("recent");
      setFocusedIndex(0);
    }
  };

  const openFocused = () => {
    if (focusedColumn() === "recent") {
      const workspace = filteredRecent()[focusedIndex()];
      if (workspace) {
        props.onOpenWorkspace(workspace);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      setIsSearchActive(true);
      props.onSearch();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "n") {
      e.preventDefault();
      props.onNewWorkspace();
    }
    if (!isSearchActive()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateDown();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateUp();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateRight();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateLeft();
      } else if (e.key === "Enter") {
        e.preventDefault();
        openFocused();
      }
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
                      <LogoIcon />
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
                    <SettingsIcon />
                  </button>
                </div>

                {/* Search Row */}
                <div class="relative">
                  <div class="text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2">
                    <SearchIcon />
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
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
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
              {/* Recent Workspaces */}
              <div class="border-border/50 border-b p-4">
                <div class="mb-3 flex items-center justify-between">
                  <h2 class="text-foreground text-sm font-semibold">Recent Workspaces</h2>
                  <span class="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {filteredRecent().length}
                  </span>
                </div>

                <div class="space-y-2">
                  <Show
                    when={filteredRecent().length > 0}
                    fallback={
                      <EmptyState
                        icon="📂"
                        title="No recent workspaces"
                        subtitle="Open a workspace to get started"
                      />
                    }
                  >
                    <For each={filteredRecent()}>
                      {(workspace, index) => (
                        <WorkspaceCard
                          workspace={workspace}
                          shortcutNumber={index() + 1}
                          onOpen={props.onOpenWorkspace}
                          onArchive={props.onArchiveWorkspace}
                          isFocused={isFocused("recent", index())}
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
