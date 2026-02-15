import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/utils";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

export type CommandCenterMode = "model" | "mcp" | "skills" | "context";

export interface ModelSelectorOption {
  id: string;
  providerId: string;
  providerName?: string;
  name?: string;
  connected: boolean;
}

export interface ModelSelectorSection {
  providerId: string;
  providerName: string;
  connected: boolean;
  models: ModelSelectorOption[];
}

interface ModelSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModelId?: string;
  mode: CommandCenterMode;
  onModeChange: (mode: CommandCenterMode) => void;
  modelSections: ModelSelectorSection[];
  onSearchChange: (query: string) => void;
  onSelect: (modelId: string) => void;
}

interface CommandEntry {
  id: string;
  label: string;
  description: string;
}

interface ModelHeadingRow {
  kind: "heading";
  key: string;
  providerName: string;
  connected: boolean;
}

interface ModelItemRow {
  kind: "model";
  key: string;
  model: ModelSelectorOption;
  connected: boolean;
}

type ModelRow = ModelHeadingRow | ModelItemRow;

const SKILL_ENTRIES: CommandEntry[] = [
  {
    id: "skill:brainstorming",
    label: "Brainstorming",
    description: "Explore intent before implementation",
  },
  { id: "skill:tdd", label: "Test-Driven Development", description: "Write failing tests first" },
  {
    id: "skill:debug",
    label: "Systematic Debugging",
    description: "Root-cause-first debugging flow",
  },
];

const MCP_ENTRIES: CommandEntry[] = [
  { id: "mcp:status", label: "MCP Servers", description: "List connected MCP servers" },
  { id: "mcp:refresh", label: "Refresh MCP Status", description: "Re-check MCP availability" },
];

const CONTEXT_ENTRIES: CommandEntry[] = [
  {
    id: "context:file",
    label: "Add File Context",
    description: "Attach file contents to prompt context",
  },
  {
    id: "context:symbol",
    label: "Add Symbol Context",
    description: "Attach selected symbol details",
  },
];

const MODE_PILLS: Array<{ mode: CommandCenterMode; label: string }> = [
  { mode: "model", label: "/model" },
  { mode: "mcp", label: "/mcp" },
  { mode: "skills", label: "/skills" },
  { mode: "context", label: "@context" },
];

export function ModelSelector(props: ModelSelectorProps) {
  const DEBUG_PREFIX = "[model-selector-debug]";
  const [query, setQuery] = createSignal("");
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [modelScrollTop, setModelScrollTop] = createSignal(0);
  const [modelViewportHeight, setModelViewportHeight] = createSignal(404);
  let searchInputRef: HTMLInputElement | undefined;
  let modelListRef: HTMLDivElement | undefined;

  const MODEL_ROW_HEIGHT = 40;
  const MODEL_VIEWPORT_FALLBACK_HEIGHT = 404;
  const MODEL_OVERSCAN = 8;

  createEffect(() => {
    props.onSearchChange(query());
  });

  const modelEntries = createMemo(() =>
    props.modelSections.flatMap(section =>
      section.models.map(model => ({
        id: model.id,
        title: model.name ?? model.id,
        subtitle: section.providerName,
      }))
    )
  );
  const modelRows = createMemo<ModelRow[]>(() =>
    props.modelSections.flatMap(section => [
      {
        kind: "heading" as const,
        key: `heading:${section.providerId}`,
        providerName: section.providerName,
        connected: section.connected,
      },
      ...section.models.map(model => ({
        kind: "model" as const,
        key: `model:${model.id}`,
        model,
        connected: section.connected,
      })),
    ])
  );
  const visibleModelRows = createMemo(() => {
    const rows = modelRows();
    const start = Math.max(0, Math.floor(modelScrollTop() / MODEL_ROW_HEIGHT) - MODEL_OVERSCAN);
    const end = Math.min(
      rows.length,
      Math.ceil((modelScrollTop() + modelViewportHeight()) / MODEL_ROW_HEIGHT) + MODEL_OVERSCAN
    );
    return rows.slice(start, end).map((row, localIndex) => ({
      row,
      absoluteIndex: start + localIndex,
    }));
  });
  const modelRowIndexById = createMemo(() => {
    const map = new Map<string, number>();
    modelRows().forEach((row, index) => {
      if (row.kind === "model") {
        map.set(row.model.id, index);
      }
    });
    return map;
  });

  const commandEntries = createMemo(() => {
    switch (props.mode) {
      case "mcp":
        return MCP_ENTRIES;
      case "skills":
        return SKILL_ENTRIES;
      case "context":
        return CONTEXT_ENTRIES;
      default:
        return [];
    }
  });

  const visibleEntryIds = createMemo(() =>
    props.mode === "model"
      ? modelEntries().map(entry => entry.id)
      : commandEntries().map(entry => entry.id)
  );

  createEffect(() => {
    if (!props.open) return;
    const ids = visibleEntryIds();
    if (ids.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (props.mode === "model") {
      const selectedIndex = ids.findIndex(id => id === props.selectedModelId);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      return;
    }
    setActiveIndex(0);
  });
  createEffect(() => {
    if (!props.open || props.mode !== "model") return;
    setModelScrollTop(0);
  });
  createEffect(() => {
    if (!props.open || props.mode !== "model") return;
    const height = modelListRef?.clientHeight ?? MODEL_VIEWPORT_FALLBACK_HEIGHT;
    if (height > 0) setModelViewportHeight(height);
  });
  createEffect(() => {
    if (!props.open) return;
    queueMicrotask(() => searchInputRef?.focus());
  });
  createEffect(() => {
    if (!props.open || props.mode !== "model") return;
    const activeId = visibleEntryIds()[activeIndex()];
    if (!activeId || !modelListRef) return;

    const rowIndex = modelRowIndexById().get(activeId);
    if (rowIndex === undefined) return;

    const rowTop = rowIndex * MODEL_ROW_HEIGHT;
    const rowBottom = rowTop + MODEL_ROW_HEIGHT;
    const viewTop = modelListRef.scrollTop;
    const viewportHeight = modelListRef.clientHeight || modelViewportHeight();
    const viewBottom = viewTop + viewportHeight;

    if (rowTop < viewTop) {
      modelListRef.scrollTop = rowTop;
      setModelScrollTop(rowTop);
      return;
    }
    if (rowBottom > viewBottom) {
      const nextTop = rowBottom - viewportHeight;
      modelListRef.scrollTop = nextTop;
      setModelScrollTop(nextTop);
    }
  });

  const handlePick = (modelId: string) => {
    if (props.mode !== "model") return;
    console.log(`${DEBUG_PREFIX} model-selector:pick`, {
      modelId,
      selectedModelId: props.selectedModelId,
    });
    props.onSelect(modelId);
    setQuery("");
    props.onOpenChange(false);
  };

  const handleCommandPick = () => {
    props.onOpenChange(false);
    setQuery("");
  };

  const handleInputKeyDown = (event: KeyboardEvent) => {
    const ids = visibleEntryIds();
    if (ids.length === 0) return;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        setActiveIndex(index => (index + 1) % ids.length);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setActiveIndex(index => (index - 1 + ids.length) % ids.length);
        break;
      }
      case "Enter": {
        event.preventDefault();
        const id = ids[activeIndex()];
        if (!id) return;
        if (props.mode === "model") {
          handlePick(id);
          return;
        }
        handleCommandPick();
        break;
      }
      case "Escape": {
        event.preventDefault();
        props.onOpenChange(false);
        break;
      }
      default:
        break;
    }
  };

  const isActive = (id: string) => visibleEntryIds()[activeIndex()] === id;

  return (
    <CommandDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      contentClass="model-selector-shell relative overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-0 shadow-2xl"
    >
      <div class="model-selector-aurora pointer-events-none absolute inset-0" />
      <div class="model-selector-grain pointer-events-none absolute inset-0" />
      <div class="border-border/70 bg-muted/45 border-b px-3.5 pb-2.5 pt-3 backdrop-blur-xl">
        <div class="mb-1.5 flex items-center justify-between">
          <div>
            <p class="text-popover-foreground text-[13px] font-semibold tracking-tight">
              Selecting model
            </p>
            <p class="text-muted-foreground text-[10px]">Command Center</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <For each={MODE_PILLS}>
            {pill => (
              <button
                type="button"
                onClick={() => props.onModeChange(pill.mode)}
                class={cn(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-all duration-200",
                  props.mode === pill.mode
                    ? "border-primary/35 bg-primary/12 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--color-primary)_45%,transparent)]"
                    : "border-border/75 bg-background/70 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                )}
              >
                {pill.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="border-border/70 bg-background/45 border-b">
        <CommandInput
          ref={searchInputRef}
          aria-label="Search models"
          value={query()}
          onValueChange={setQuery}
          onKeyDown={handleInputKeyDown}
          placeholder={
            props.mode === "model"
              ? "Search providers and models..."
              : props.mode === "mcp"
                ? "Search MCP commands..."
                : props.mode === "skills"
                  ? "Search skills..."
                  : "Search context commands..."
          }
          class="text-popover-foreground"
        />
      </div>

      <CommandList
        aria-label="Model selector"
        class="bg-background/35 [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 h-[420px] !max-h-none overflow-hidden px-1.5 py-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
      >
        <Show
          when={props.mode === "model" ? modelEntries().length > 0 : commandEntries().length > 0}
          fallback={<CommandEmpty class="text-muted-foreground">No results found.</CommandEmpty>}
        >
          <Show when={props.mode === "model"}>
            <div
              ref={modelListRef}
              class="[&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 h-[404px] overflow-y-auto [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
              data-component="model-selector-virtual-list"
              onScroll={event => setModelScrollTop(event.currentTarget.scrollTop)}
            >
              <div
                class="relative w-full"
                style={{ height: `${modelRows().length * MODEL_ROW_HEIGHT}px` }}
              >
                <For each={visibleModelRows()}>
                  {entry => (
                    <div
                      class="absolute left-0 right-0"
                      style={{
                        top: `${entry.absoluteIndex * MODEL_ROW_HEIGHT}px`,
                        height: `${MODEL_ROW_HEIGHT}px`,
                      }}
                    >
                      <Show
                        when={entry.row.kind === "heading"}
                        fallback={
                          <div class="px-1 py-0.5">
                            <CommandItem
                              value={(entry.row as ModelItemRow).model.id}
                              aria-selected={
                                props.selectedModelId === (entry.row as ModelItemRow).model.id
                              }
                              class={cn(
                                "text-popover-foreground hover:border-border/90 hover:bg-muted/70 group relative h-9 rounded-md border border-transparent px-2.5 transition-all duration-200",
                                props.selectedModelId === (entry.row as ModelItemRow).model.id &&
                                  "border-primary/35 bg-primary/10 text-primary",
                                isActive((entry.row as ModelItemRow).model.id) &&
                                  "border-primary/45 bg-accent/70 shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_45%,transparent),0_8px_24px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
                              )}
                              onPick={handlePick}
                            >
                              <span class="truncate">
                                {(entry.row as ModelItemRow).model.name ??
                                  (entry.row as ModelItemRow).model.id}
                              </span>
                            </CommandItem>
                          </div>
                        }
                      >
                        <div class="px-1 py-0.5">
                          <div class="border-border/80 bg-muted/60 text-foreground flex items-center justify-between rounded-md border px-2 py-1 text-[11px] font-medium">
                            <span class="truncate">
                              {(entry.row as ModelHeadingRow).providerName}
                            </span>
                            <span
                              class={cn(
                                "ml-2 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                                (entry.row as ModelHeadingRow).connected
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground"
                              )}
                            >
                              {(entry.row as ModelHeadingRow).connected
                                ? "Connected"
                                : "Not Connected"}
                            </span>
                          </div>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={props.mode !== "model"}>
            <CommandGroup
              heading={
                props.mode === "mcp" ? "MCP" : props.mode === "skills" ? "Skills" : "Context"
              }
              class="[&_[cmdk-group-heading]]:border-border/80 [&_[cmdk-group-heading]]:bg-muted/60 [&_[cmdk-group-heading]]:text-foreground [&_[cmdk-group-heading]]:rounded-md [&_[cmdk-group-heading]]:border"
            >
              <For each={commandEntries()}>
                {entry => (
                  <CommandItem
                    value={entry.id}
                    class={cn(
                      "text-popover-foreground hover:border-border/90 hover:bg-muted/70 h-9 rounded-md border border-transparent px-2.5 transition-all duration-200",
                      isActive(entry.id) &&
                        "border-primary/45 bg-accent/70 shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_45%,transparent),0_8px_24px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
                    )}
                    onPick={handleCommandPick}
                  >
                    <span class="truncate">{entry.label}</span>
                    <span class="text-muted-foreground ml-auto text-[11px]">
                      {entry.description}
                    </span>
                  </CommandItem>
                )}
              </For>
            </CommandGroup>
          </Show>
        </Show>
      </CommandList>

      <div class="text-muted-foreground border-border/80 bg-muted/55 flex items-center justify-end gap-2 border-t px-3 py-1.5 text-[10px] backdrop-blur-xl">
        <kbd class="border-border bg-background text-foreground rounded border px-1.5 py-0.5">
          Enter
        </kbd>
        <span>Select</span>
        <kbd class="border-border bg-background text-foreground ml-2 rounded border px-1.5 py-0.5">
          ↑↓
        </kbd>
        <span>Navigate</span>
        <kbd class="border-border bg-background text-foreground ml-2 rounded border px-1.5 py-0.5">
          Esc
        </kbd>
        <span>Close</span>
      </div>
    </CommandDialog>
  );
}
