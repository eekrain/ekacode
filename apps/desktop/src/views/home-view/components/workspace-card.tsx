import type { RecentProject } from "@/core/chat/types";
import { GitBranch } from "lucide-solid";
import { Show } from "solid-js";

interface WorkspaceCardProps {
  workspace: RecentProject;
  shortcutNumber: number;
  onOpen: (workspace: RecentProject) => void;
  onArchive: (workspace: RecentProject) => void;
  isFocused?: boolean;
}

function getStatusDotClass(gitStatus: RecentProject["gitStatus"]): string {
  if (!gitStatus) return "bg-blue-500";
  if (gitStatus.ahead > 0 && gitStatus.behind === 0) return "bg-green-500";
  if (gitStatus.behind > 0) return "bg-yellow-500";
  return "bg-blue-500";
}

function getStatusTextClass(gitStatus: RecentProject["gitStatus"]): string {
  if (!gitStatus) return "text-blue-500";
  if (gitStatus.ahead > 0 && gitStatus.behind === 0) return "text-green-600 dark:text-green-400";
  if (gitStatus.behind > 0) return "text-yellow-600 dark:text-yellow-400";
  return "text-blue-500";
}

function getGitStatusText(gitStatus: RecentProject["gitStatus"]): string {
  if (!gitStatus) return "Clean";
  if (gitStatus.ahead > 0 && gitStatus.behind === 0) return `+${gitStatus.ahead} ahead`;
  if (gitStatus.behind > 0) return `-${gitStatus.behind} behind`;
  return "Clean";
}

export function WorkspaceCard(props: WorkspaceCardProps) {
  const handleOpen = () => {
    props.onOpen(props.workspace);
  };

  const handleArchive = (e: Event) => {
    e.stopPropagation();
    props.onArchive(props.workspace);
  };

  return (
    <div
      class={`bg-card border-border group relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        props.isFocused ? "ring-primary ring-offset-background ring-2 ring-offset-2" : ""
      }`}
      data-test="workspace-card"
      tabIndex={0}
      onClick={handleOpen}
    >
      {/* Shortcut badge */}
      <div class="absolute right-3 top-3">
        <span class="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-medium">
          ⌘{props.shortcutNumber}
        </span>
      </div>

      {/* Status dot */}
      <div class="mb-3 flex items-center gap-2">
        <div
          class={`h-2 w-2 rounded-full ${getStatusDotClass(props.workspace.gitStatus)}`}
          data-test="status-dot"
        />
      </div>

      {/* Content */}
      <div class="space-y-1">
        <h3
          class="text-foreground truncate pr-16 text-base font-semibold"
          data-test="workspace-name"
        >
          {props.workspace.name}
        </h3>
        <p class="text-muted-foreground truncate text-sm" data-test="workspace-path">
          {props.workspace.path}
        </p>
      </div>

      {/* Git info */}
      <Show when={props.workspace.gitStatus}>
        <div class="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
          <GitBranch class="h-3.5 w-3.5" />
          <span class="font-medium">{props.workspace.gitStatus?.branch}</span>
          <span>→ {props.workspace.gitStatus?.baseBranch}</span>
          <span class={getStatusTextClass(props.workspace.gitStatus)}>
            {getGitStatusText(props.workspace.gitStatus)}
          </span>
        </div>
      </Show>

      {/* Actions */}
      <div class="mt-4 flex gap-2">
        <button
          class="bg-primary text-primary-foreground flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          data-test="open-button"
          onClick={handleOpen}
        >
          Open
        </button>
        <button
          class="border-border text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          data-test="archive-button"
          onClick={handleArchive}
        >
          Archive
        </button>
      </div>
    </div>
  );
}
