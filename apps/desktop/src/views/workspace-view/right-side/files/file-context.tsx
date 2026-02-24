import type { FileTab as FileTabType } from "@/core/chat/types";
import { cn } from "@/utils";
import { FileText } from "lucide-solid";
import { Component, For, Show, createSignal } from "solid-js";
import { FileTab } from "./file-tab";

interface FileContextProps {
  class?: string;
}

export const FileContext: Component<FileContextProps> = props => {
  const [openFiles, setOpenFiles] = createSignal<FileTabType[]>([
    {
      id: "file-1",
      path: "/src/App.tsx",
      name: "App.tsx",
      isModified: false,
      isActive: true,
    },
  ]);

  const activeTab = () => openFiles().find(t => t.isActive);

  const handleTabClick = (tab: FileTabType) => {
    setOpenFiles(prev =>
      prev.map(t => ({
        ...t,
        isActive: t.id === tab.id,
      }))
    );
  };

  const handleTabClose = (tab: FileTabType) => {
    setOpenFiles(prev => {
      const filtered = prev.filter(t => t.id !== tab.id);
      if (tab.isActive && filtered.length > 0) {
        filtered[filtered.length - 1].isActive = true;
      }
      return filtered;
    });
  };

  return (
    <div class={cn("flex h-[60%] flex-col", "border-border/30 border-b", props.class)}>
      {/* Tab bar */}
      <div
        class={cn(
          "flex items-center gap-0.5 px-2 py-1",
          "bg-card/10 border-border/30 border-b",
          "scrollbar-default overflow-x-auto"
        )}
      >
        {/* Label */}
        <span class="text-muted-foreground/50 flex-shrink-0 px-2 py-1 text-xs font-medium uppercase tracking-wider">
          Files
        </span>

        {/* Divider */}
        <div class="bg-border/30 mx-1 h-4 w-px flex-shrink-0" />

        {/* Tabs */}
        <For each={openFiles()}>
          {tab => (
            <FileTab
              tab={tab}
              onClick={() => handleTabClick(tab)}
              onClose={() => handleTabClose(tab)}
            />
          )}
        </For>

        {/* Empty state hint */}
        <Show when={openFiles().length === 0}>
          <span class="text-muted-foreground/40 px-3 py-1 text-xs italic">No files open</span>
        </Show>
      </div>

      {/* File content area (placeholder) */}
      <div class="flex-1 overflow-auto p-4">
        <Show
          when={activeTab()}
          fallback={
            <div class="flex h-full flex-col items-center justify-center text-center">
              <FileText class="text-muted-foreground/20 mb-3 h-12 w-12" />
              <p class="text-muted-foreground/50 text-sm">No file selected</p>
              <p class="text-muted-foreground/30 mt-1 text-xs">Open a file to see its contents</p>
            </div>
          }
        >
          {tab => (
            <div class="h-full">
              {/* File header */}
              <div class="border-border/20 mb-3 flex items-center justify-between border-b pb-2">
                <div class="flex items-center gap-2">
                  <FileText class="text-primary/60 h-4 w-4" />
                  <span class="text-foreground/80 text-sm font-medium">{tab().name}</span>
                  <Show when={tab().isModified}>
                    <span class="bg-primary/20 text-primary/70 rounded px-1.5 py-0.5 text-[10px] font-medium">
                      Modified
                    </span>
                  </Show>
                </div>
                <span class="text-muted-foreground/40 font-mono text-xs">{tab().path}</span>
              </div>

              {/* Placeholder content */}
              <div class="text-muted-foreground/30 text-sm italic">
                File content preview will appear here...
              </div>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};
