import { cn } from "@/utils";
import * as DialogPrimitive from "@kobalte/core/dialog";
import { createPresence } from "@solid-primitives/presence";
import type { Component, ComponentProps, JSX, ParentComponent } from "solid-js";
import { Show, createEffect, splitProps } from "solid-js";

export const CommandRoot: ParentComponent<ComponentProps<"div">> = props => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <div
      class={cn("bg-background text-foreground rounded-md", local.class)}
      cmdk-root=""
      {...others}
    >
      {local.children}
    </div>
  );
};

export const CommandDialog: ParentComponent<{
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  contentClass?: string;
  children: JSX.Element;
}> = props => {
  const DEBUG_PREFIX = "[command-dialog-debug]";
  const [local] = splitProps(props, ["open", "onOpenChange", "children", "contentClass"]);
  const presence = createPresence(() => (local.open ? true : undefined), {
    transitionDuration: 220,
    initialEnter: true,
  });
  createEffect(() => {
    console.log(`${DEBUG_PREFIX} lifecycle`, {
      open: local.open,
      isMounted: presence.isMounted(),
      isVisible: presence.isVisible(),
      isEntering: presence.isEntering(),
      isExiting: presence.isExiting(),
    });
  });

  return (
    <Show when={presence.isMounted()}>
      <DialogPrimitive.Root
        open={local.open}
        forceMount={true}
        onOpenChange={local.onOpenChange}
        modal
      >
        <DialogPrimitive.Portal>
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <DialogPrimitive.Overlay
              data-component="command-dialog-overlay"
              data-visible={presence.isVisible() ? "" : undefined}
              data-exiting={presence.isExiting() ? "" : undefined}
              class={cn("command-dialog-overlay-motion fixed inset-0")}
            />
            <DialogPrimitive.Content
              data-component="command-dialog-content"
              data-visible={presence.isVisible() ? "" : undefined}
              data-exiting={presence.isExiting() ? "" : undefined}
              class={cn(
                "command-dialog-content-motion fixed left-1/2 top-1/2 w-[680px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
                local.contentClass
              )}
            >
              <CommandRoot class="bg-popover text-popover-foreground border-border flex size-full flex-col overflow-hidden rounded-md border shadow-lg blur-none">
                {local.children}
              </CommandRoot>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </Show>
  );
};

export const CommandInput: Component<
  Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "onInput"> & {
    onValueChange?: (value: string) => void;
  }
> = props => {
  const [local, others] = splitProps(props, ["class", "onValueChange"]);
  return (
    <div class="flex items-center border-b px-3" cmdk-input-wrapper="">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="mr-2 size-4 shrink-0 opacity-50"
      >
        <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
        <path d="M21 21l-6 -6" />
      </svg>
      <input
        role="combobox"
        autocomplete="off"
        cmdk-input=""
        class={cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          local.class
        )}
        onInput={event => local.onValueChange?.(event.currentTarget.value)}
        {...others}
      />
    </div>
  );
};

export const CommandList: ParentComponent<ComponentProps<"div">> = props => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <div
      role="listbox"
      cmdk-list=""
      class={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", local.class)}
      {...others}
    >
      {local.children}
    </div>
  );
};

export const CommandGroup: ParentComponent<
  { heading?: string } & ComponentProps<"div">
> = props => {
  const [local, others] = splitProps(props, ["class", "children", "heading"]);
  return (
    <div class={cn("text-foreground overflow-hidden p-1", local.class)} {...others}>
      {local.heading ? (
        <p cmdk-group-heading="" class="text-muted-foreground px-2 py-1.5 text-xs font-medium">
          {local.heading}
        </p>
      ) : null}
      {local.children}
    </div>
  );
};

export const CommandItem: ParentComponent<
  {
    value: string;
    onPick?: (value: string) => void;
  } & ComponentProps<"button">
> = props => {
  const [local, others] = splitProps(props, ["class", "children", "value", "onPick"]);
  return (
    <button
      type="button"
      role="option"
      cmdk-item=""
      class={cn(
        "aria-selected:bg-accent aria-selected:text-accent-foreground relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        local.class
      )}
      onClick={() => local.onPick?.(local.value)}
      {...others}
    >
      {local.children}
    </button>
  );
};

export const CommandEmpty: ParentComponent<ComponentProps<"div">> = props => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <div class={cn("text-muted-foreground px-2 py-3 text-center text-xs", local.class)} {...others}>
      {local.children}
    </div>
  );
};

export const CommandSeparator: Component<ComponentProps<"div">> = props => {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("bg-border h-px", local.class)} {...others} />;
};
