import { Show } from "solid-js";

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <div
      class="border-border flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center"
      data-test="empty-state"
    >
      <Show when={props.icon}>
        <span class="mb-3 text-4xl opacity-50" data-test="empty-icon">
          {props.icon}
        </span>
      </Show>
      <h3 class="text-foreground text-sm font-medium" data-test="empty-title">
        {props.title}
      </h3>
      <Show when={props.subtitle}>
        <p class="text-muted-foreground mt-1 text-xs" data-test="empty-subtitle">
          {props.subtitle}
        </p>
      </Show>
    </div>
  );
}
