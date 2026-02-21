import type { Component, ComponentProps, JSX } from "solid-js";
import { Show } from "solid-js";

import { cn } from "@/utils";

interface SettingsSectionProps extends ComponentProps<"div"> {
  title: string;
  description?: string;
  children: JSX.Element;
}

const SettingsSection: Component<SettingsSectionProps> = props => {
  return (
    <div class={cn("mb-6", props.class)}>
      <div class="border-border mb-3 border-b pb-2">
        <div class="text-foreground text-sm font-semibold">{props.title}</div>
        <Show when={props.description}>
          <div class="text-muted-foreground text-xs">{props.description}</div>
        </Show>
      </div>
      <div class="space-y-1">{props.children}</div>
    </div>
  );
};

export { SettingsSection };
export type { SettingsSectionProps };
