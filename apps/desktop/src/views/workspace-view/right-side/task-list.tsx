import type { Task } from "@/core/chat/types/task";
import { cn } from "@/utils";
import { Component, For, Show } from "solid-js";

interface TaskListProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  class?: string;
}

/**
 * TaskList - Displays a list of tasks in the right panel
 *
 * Shows only when there are open tasks (status !== "closed")
 * Similar to OpenCode's sidebar todo display
 */
export const TaskList: Component<TaskListProps> = props => {
  const openTasks = () => props.tasks.filter(t => t.status !== "closed");

  return (
    <Show when={openTasks().length > 0}>
      <div class={cn("flex flex-col gap-1 overflow-y-auto p-2", props.class)}>
        <For each={openTasks()}>
          {task => (
            <div
              class={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg p-2",
                "bg-card/20 hover:bg-card/40 transition-colors",
                "border-border/30 hover:border-primary/30 border"
              )}
              onClick={() => props.onTaskClick?.(task)}
            >
              {/* Status indicator */}
              <div
                class={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  task.status === "open" && "bg-yellow-500",
                  task.status === "in_progress" && "bg-blue-500",
                  task.status === "closed" && "bg-green-500"
                )}
              />

              {/* Priority badge */}
              <Show when={task.priority <= 1}>
                <span class="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                  P{task.priority}
                </span>
              </Show>

              {/* Title */}
              <span class="flex-1 truncate text-sm">{task.title}</span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};
