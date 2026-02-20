import type { RecentProject } from "@/core/chat/types";
import { Show } from "solid-js";

const GitBranchIcon = () => (
  <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M21.62 11.108l-8.731-8.729a1.292 1.292 0 0 0-1.823 0L9.257 4.19l2.299 2.3a1.532 1.532 0 0 1 1.939 1.95l2.214 2.217a1.53 1.53 0 0 1 1.583 2.531c-.599.6-1.566.6-2.166 0a1.536 1.536 0 0 1-.337-1.662l-2.074-2.063V14.3a1.528 1.528 0 0 1 .724 2.073 1.531 1.531 0 1 1-2.1-2.073c.238-.236.533-.39.838-.456V9.358c-.217-.054-.424-.166-.6-.333l-4.79-4.791a1.292 1.292 0 0 0-1.823 0L.932 11.684a1.292 1.292 0 0 0 0 1.823l8.73 8.729a1.292 1.292 0 0 0 1.823 0l10.135-10.128z" />
  </svg>
);

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
          <GitBranchIcon />
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
