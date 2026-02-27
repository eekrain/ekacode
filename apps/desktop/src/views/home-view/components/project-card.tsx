import type { RecentProject } from "@/core/chat/types";
import { Folder, FolderOpen } from "lucide-solid";
import { For, Show } from "solid-js";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    path?: string;
  };
  workspaces: RecentProject[];
  onOpenProject: () => void;
  onOpenWorkspace: (workspace: RecentProject) => void;
}

export function ProjectCard(props: ProjectCardProps) {
  const formatLastOpened = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div class="bg-card border-border/50 rounded-xl border p-4">
      <div class="mb-3 flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <Folder class="text-primary h-5 w-5" />
          </div>
          <div>
            <h3 class="text-foreground font-semibold">{props.project.name}</h3>
            <Show when={props.project.path}>
              <p class="text-muted-foreground max-w-[200px] truncate text-xs">
                {props.project.path}
              </p>
            </Show>
          </div>
        </div>
        <button
          class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          onClick={() => props.onOpenProject()}
        >
          Open
        </button>
      </div>

      <div class="border-border/50 border-t pt-3">
        <div class="space-y-1.5">
          <For each={props.workspaces}>
            {workspace => (
              <button
                class="hover:bg-muted text-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
                onClick={() => props.onOpenWorkspace(workspace)}
              >
                <Show
                  when={workspace.gitStatus?.hasUncommitted}
                  fallback={
                    <span class="text-muted-foreground">
                      <FolderOpen class="h-4 w-4" />
                    </span>
                  }
                >
                  <span class="text-orange-500">
                    <Folder class="h-4 w-4" />
                  </span>
                </Show>
                <span class="flex-1 truncate">{workspace.name}</span>
                <span class="text-muted-foreground text-xs">
                  {formatLastOpened(workspace.lastOpened)}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
