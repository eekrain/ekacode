import { Component, For, Show, createSignal, mergeProps } from "solid-js";
import { cn } from "/@/lib/utils";

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  icon?: string;
}

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface ChatHeaderProps {
  /** Breadcrumb navigation items */
  breadcrumbs?: BreadcrumbItem[];
  /** Current project name */
  projectName?: string;
  /** Available model options */
  models?: ModelOption[];
  /** Currently selected model */
  selectedModel?: string;
  /** Model change handler */
  onModelChange?: (modelId: string) => void;
  /** Additional CSS classes */
  class?: string;
}

/**
 * ChatHeader - Header for the chat panel with breadcrumb and model selector
 *
 * Design Features:
 * - Breadcrumb navigation showing workspace path
 * - Model selector dropdown with provider icons
 * - Project name display
 * - Minimal height to maximize chat space
 */
export const ChatHeader: Component<ChatHeaderProps> = props => {
  const merged = mergeProps(
    {
      breadcrumbs: [] as BreadcrumbItem[],
      projectName: "ekacode",
      models: [
        { id: "claude-opus", name: "Claude Opus", provider: "anthropic" },
        { id: "claude-sonnet", name: "Claude Sonnet", provider: "anthropic" },
        { id: "gpt-4", name: "GPT-4", provider: "openai" },
      ] as ModelOption[],
      selectedModel: "claude-sonnet",
    },
    props
  );

  const [showModelDropdown, setShowModelDropdown] = createSignal(false);

  const currentModel = () =>
    merged.models.find(m => m.id === merged.selectedModel) || merged.models[0];

  return (
    <div
      class={cn(
        "flex items-center justify-between px-4 py-3",
        "border-border/30 border-b",
        "bg-card/5",
        props.class
      )}
    >
      {/* Breadcrumb navigation */}
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <For each={merged.breadcrumbs}>
          {(item, index) => (
            <>
              <Show when={index() > 0}>
                <svg
                  class="text-muted-foreground/40 h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Show>
              <span
                class={cn(
                  "truncate text-sm",
                  index() === merged.breadcrumbs.length - 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/60 hover:text-muted-foreground/80 cursor-pointer transition-colors"
                )}
              >
                {item.label}
              </span>
            </>
          )}
        </For>
      </div>

      {/* Model selector */}
      <div class="relative">
        <button
          onClick={() => setShowModelDropdown(!showModelDropdown())}
          class={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5",
            "bg-card/20 hover:bg-card/40",
            "border-border/30 hover:border-primary/30 border",
            "transition-all duration-200",
            "hover:shadow-sm"
          )}
        >
          <div
            class={cn(
              "flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold",
              "bg-primary/20 text-primary"
            )}
          >
            {currentModel()?.provider?.[0]?.toUpperCase() || "AI"}
          </div>
          <span class="text-foreground/80 text-sm">{currentModel()?.name}</span>
          <svg
            class={cn(
              "text-muted-foreground/50 h-3.5 w-3.5 transition-transform duration-200",
              showModelDropdown() && "rotate-180"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Model dropdown */}
        <Show when={showModelDropdown()}>
          <div
            class={cn(
              "absolute right-0 z-50 mt-2 w-56",
              "bg-card/80 border-border/40 border backdrop-blur-md",
              "rounded-lg shadow-lg",
              "animate-fade-in-up"
            )}
            onClick={(e: MouseEvent) => {
              // Close dropdown when clicking outside (simple implementation)
              e.stopPropagation();
            }}
            onmousedown={(e: MouseEvent) => {
              // Check if click is outside dropdown
              const target = e.target as HTMLElement;
              if (!target.closest(".model-dropdown")) {
                setShowModelDropdown(false);
              }
            }}
          >
            <For each={merged.models}>
              {model => (
                <button
                  onClick={() => {
                    merged.onModelChange?.(model.id);
                    setShowModelDropdown(false);
                  }}
                  class={cn(
                    "flex w-full items-center gap-3 px-3 py-2",
                    "hover:bg-card/40 transition-colors duration-150",
                    "first:rounded-t-lg last:rounded-b-lg",
                    model.id === merged.selectedModel && "bg-primary/10"
                  )}
                >
                  <div
                    class={cn(
                      "flex h-6 w-6 items-center justify-center rounded text-xs font-semibold",
                      model.id === merged.selectedModel
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/20 text-primary"
                    )}
                  >
                    {model.provider?.[0]?.toUpperCase() || "AI"}
                  </div>
                  <div class="flex-1 text-left">
                    <div
                      class={cn(
                        "text-sm",
                        model.id === merged.selectedModel
                          ? "text-foreground font-medium"
                          : "text-foreground/80"
                      )}
                    >
                      {model.name}
                    </div>
                    <div class="text-muted-foreground/60 text-xs">{model.provider}</div>
                  </div>
                  <Show when={model.id === merged.selectedModel}>
                    <svg class="text-primary h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};
