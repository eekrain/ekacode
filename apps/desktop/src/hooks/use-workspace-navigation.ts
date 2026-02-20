import type { ArchivedWorkspace, RecentProject } from "@/core/chat/types";
import { createSignal } from "solid-js";

type Column = "recent" | "archived";

interface UseWorkspaceNavigationProps {
  recentWorkspaces: RecentProject[];
  archivedWorkspaces: ArchivedWorkspace[];
  onOpen: (workspace: RecentProject) => void;
}

export function useWorkspaceNavigation(props: UseWorkspaceNavigationProps) {
  const [focusedColumn, setFocusedColumn] = createSignal<Column>("recent");
  const [focusedIndex, setFocusedIndex] = createSignal(0);

  const getCurrentColumnLength = (): number => {
    if (focusedColumn() === "recent") {
      return props.recentWorkspaces.length;
    }
    return props.archivedWorkspaces.length;
  };

  const navigateDown = () => {
    const maxIndex = getCurrentColumnLength() - 1;
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
      const workspace = props.recentWorkspaces[focusedIndex()];
      if (workspace) {
        props.onOpen(workspace);
      }
    }
  };

  const isFocused = (column: Column, index: number): boolean => {
    return focusedColumn() === column && focusedIndex() === index;
  };

  return {
    focusedColumn,
    focusedIndex,
    navigateDown,
    navigateUp,
    navigateRight,
    navigateLeft,
    openFocused,
    isFocused,
  };
}
