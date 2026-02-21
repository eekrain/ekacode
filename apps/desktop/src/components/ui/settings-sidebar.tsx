import type { Component, ComponentProps, JSX } from "solid-js";
import { For, splitProps } from "solid-js";

import { cn } from "@/utils";

export type SettingsSidebarItem = {
  id: string;
  title: string;
  icon?: JSX.Element;
  isExternal?: boolean;
};

const SETTINGS_MENU_ITEMS: SettingsSidebarItem[] = [
  { id: "general", title: "General" },
  { id: "account", title: "Account" },
  { id: "git", title: "Git" },
  { id: "terminal", title: "Terminal" },
  { id: "mcp", title: "MCP" },
  { id: "commands", title: "Commands" },
  { id: "agents", title: "Agents" },
  { id: "memory", title: "Memory" },
  { id: "hooks", title: "Hooks" },
  { id: "providers", title: "Providers" },
  { id: "experimental", title: "Experimental" },
  { id: "changelog", title: "Changelog", isExternal: true },
  { id: "docs", title: "Docs", isExternal: true },
];

interface SettingsSidebarProps extends ComponentProps<"div"> {
  selectedId: string;
  onItemSelect: (id: string) => void;
}

const SettingsSidebar: Component<SettingsSidebarProps> = props => {
  const [local, others] = splitProps(props, ["selectedId", "onItemSelect"]);

  return (
    <div class={cn("h-full overflow-y-auto px-2 py-2", others.class)}>
      <For each={SETTINGS_MENU_ITEMS}>
        {item => {
          const isSelected = () => local.selectedId === item.id;
          return (
            <button
              class={cn(
                "duration-120 group w-full rounded-md border px-2.5 py-2 text-left transition-all",
                isSelected()
                  ? "border-primary/45 bg-accent/70 shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_45%,transparent),0_8px_24px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
                  : "hover:border-border/90 hover:bg-muted/70 border-transparent"
              )}
              onClick={() => local.onItemSelect(item.id)}
            >
              <span class="truncate text-sm font-medium">
                {item.title}
                {item.isExternal && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-muted-foreground ml-1 inline size-3"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" x2="21" y1="14" y2="3" />
                  </svg>
                )}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
};

export { SettingsSidebar };
export type { SettingsSidebarProps };
