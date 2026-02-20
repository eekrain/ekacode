import type { Component, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import * as DropdownMenuPrimitive from "@kobalte/core/dropdown-menu";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";

import { cn } from "@/utils";

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenu: Component<DropdownMenuPrimitive.DropdownMenuRootProps> = props => (
  <DropdownMenuPrimitive.Root gutter={4} {...props} />
);

type DropdownMenuContentProps<T extends ValidComponent = "div"> =
  DropdownMenuPrimitive.DropdownMenuContentProps<T> & {
    class?: string;
  };

const DropdownMenuContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuContentProps<T>>
) => {
  const [, rest] = splitProps(props as DropdownMenuContentProps, ["class"]);
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        class={cn(
          "bg-popover text-popover-foreground z-50 min-w-[200px] overflow-hidden rounded-md border p-1 shadow-lg",
          props.class
        )}
        {...rest}
      />
    </DropdownMenuPrimitive.Portal>
  );
};

type DropdownMenuRadioItemProps<T extends ValidComponent = "div"> =
  DropdownMenuPrimitive.DropdownMenuRadioItemProps<T> & {
    class?: string;
  };

const DropdownMenuRadioItem = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, DropdownMenuRadioItemProps<T>>
) => {
  const [, rest] = splitProps(props as DropdownMenuRadioItemProps, ["class"]);
  return (
    <DropdownMenuPrimitive.RadioItem
      class={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-3 py-2 text-sm font-medium outline-none transition-all duration-150",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground hover:shadow-sm",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "animate-fade-in-up",
        props.class
      )}
      {...rest}
    />
  );
};

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuTrigger,
};
