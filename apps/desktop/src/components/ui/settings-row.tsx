import type { Component, ComponentProps, JSX } from "solid-js";
import { Show } from "solid-js";

import { cn } from "@/utils";

interface SettingsRowProps extends ComponentProps<"div"> {
  label: string;
  description?: string;
  children: JSX.Element;
}

const SettingsRow: Component<SettingsRowProps> = props => {
  return (
    <div class={cn("flex items-center justify-between gap-4 py-3", props.class)}>
      <div class="flex-1">
        <div class="text-foreground text-sm font-medium">{props.label}</div>
        <Show when={props.description}>
          <div class="text-muted-foreground text-xs">{props.description}</div>
        </Show>
      </div>
      <div class="flex-shrink-0">{props.children}</div>
    </div>
  );
};

export { SettingsRow };
export type { SettingsRowProps };
