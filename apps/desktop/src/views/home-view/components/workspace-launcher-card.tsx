import type { JSX } from "solid-js";

import { cn } from "@/utils";
import { Maximize2 } from "lucide-solid";

interface WorkspaceLauncherCardProps {
  icon: JSX.Element;
  iconBgColor?: string;
  iconColor?: string;
  hoverIconBgColor?: string;
  hoverIconColor?: string;
  title: string;
  description: string;
  onClick: () => void;
  class?: string;
}

export function WorkspaceLauncherCard(props: WorkspaceLauncherCardProps) {
  return (
    <button
      onClick={props.onClick}
      class={cn(
        "border-border bg-card hover:border-primary/30 group relative flex h-64 flex-col justify-between rounded-2xl border p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        props.class
      )}
    >
      <div
        class={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-colors",
          props.iconBgColor || "bg-primary/10",
          props.iconColor || "text-primary",
          "group-hover:" + (props.hoverIconBgColor || "bg-primary"),
          "group-hover:" + (props.hoverIconColor || "text-primary-foreground")
        )}
      >
        {props.icon}
      </div>
      <div>
        <h3 class="text-foreground mb-1 text-lg font-semibold">{props.title}</h3>
        <p class="text-muted-foreground text-sm">{props.description}</p>
      </div>
      <div class="text-primary absolute right-6 top-6 opacity-0 transition-opacity group-hover:opacity-100">
        <Maximize2 width={24} height={24} />
      </div>
    </button>
  );
}
