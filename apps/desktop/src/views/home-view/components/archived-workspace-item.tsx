import type { ArchivedWorkspace } from "@/core/chat/types";

interface ArchivedWorkspaceItemProps {
  workspace: ArchivedWorkspace;
  onRestore: (workspace: ArchivedWorkspace) => void;
}

export function ArchivedWorkspaceItem(props: ArchivedWorkspaceItemProps) {
  const handleRestore = () => {
    props.onRestore(props.workspace);
  };

  const formatArchivedDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      class="bg-card border-border hover:border-muted-foreground/30 flex items-center gap-3 rounded-lg border p-3 transition-colors"
      data-test="archived-workspace-item"
    >
      {/* Status icon */}
      <div class="text-sm">
        <span class={props.workspace.isMerged ? "text-green-500" : "text-red-500"}>
          {props.workspace.isMerged ? "✓" : "✗"}
        </span>
      </div>

      {/* Info */}
      <div class="min-w-0 flex-1">
        <p class="text-foreground truncate text-sm font-medium" data-test="workspace-name">
          {props.workspace.name}
        </p>
        <p class="text-muted-foreground truncate text-xs" data-test="archived-date">
          Archived {formatArchivedDate(props.workspace.archivedAt)}
        </p>
      </div>

      {/* Restore button */}
      <button
        class="border-border text-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        data-test="restore-button"
        onClick={handleRestore}
      >
        Restore
      </button>
    </div>
  );
}
