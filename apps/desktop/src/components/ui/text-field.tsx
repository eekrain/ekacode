import type { Component, ComponentProps, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as TextFieldPrimitive from "@kobalte/core/text-field";

import { cn } from "@/utils";

type TextFieldRootProps<T extends ValidComponent = "div"> =
  TextFieldPrimitive.TextFieldRootProps<T> & {
    class?: string;
  };

const TextFieldRoot = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TextFieldRootProps<T>>
) => {
  const [local, others] = splitProps(props as TextFieldRootProps, ["class"]);

  return <TextFieldPrimitive.Root class={cn("flex flex-col gap-1.5", local.class)} {...others} />;
};

type TextFieldInputProps<T extends ValidComponent = "input"> =
  TextFieldPrimitive.TextFieldInputProps<T> & {
    class?: string;
    type?:
      | "button"
      | "checkbox"
      | "color"
      | "date"
      | "datetime-local"
      | "email"
      | "file"
      | "hidden"
      | "image"
      | "month"
      | "number"
      | "password"
      | "radio"
      | "range"
      | "reset"
      | "search"
      | "submit"
      | "tel"
      | "text"
      | "time"
      | "url"
      | "week";
  };

const TextFieldInput = <T extends ValidComponent = "input">(
  props: PolymorphicProps<T, TextFieldInputProps<T>>
) => {
  const [local, others] = splitProps(props as TextFieldInputProps, ["class", "type"]);

  return (
    <TextFieldPrimitive.Input
      type={local.type ?? "text"}
      class={cn(
        "border-input flex h-10 w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-all duration-200",
        "text-foreground placeholder:text-muted-foreground",
        "outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[invalid]:border-destructive data-[invalid]:text-destructive",
        local.class
      )}
      {...others}
    />
  );
};

type TextFieldTextAreaProps<T extends ValidComponent = "textarea"> =
  TextFieldPrimitive.TextFieldTextAreaProps<T> & {
    class?: string;
  };

const TextFieldTextArea = <T extends ValidComponent = "textarea">(
  props: PolymorphicProps<T, TextFieldTextAreaProps<T>>
) => {
  const [local, others] = splitProps(props as TextFieldTextAreaProps, ["class"]);

  return (
    <TextFieldPrimitive.TextArea
      class={cn(
        "border-input flex min-h-[80px] w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-all duration-200",
        "text-foreground placeholder:text-muted-foreground",
        "focus:border-ring focus:ring-ring/10 outline-none focus:ring-4",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[invalid]:border-destructive data-[invalid]:text-destructive",
        local.class
      )}
      {...others}
    />
  );
};

type TextFieldLabelProps<T extends ValidComponent = "label"> =
  TextFieldPrimitive.TextFieldLabelProps<T> & {
    class?: string;
  };

const TextFieldLabel = <T extends ValidComponent = "label">(
  props: PolymorphicProps<T, TextFieldLabelProps<T>>
) => {
  const [local, others] = splitProps(props as TextFieldLabelProps, ["class"]);

  return (
    <TextFieldPrimitive.Label
      class={cn(
        "text-foreground text-sm font-medium leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        local.class
      )}
      {...others}
    />
  );
};

type TextFieldDescriptionProps<T extends ValidComponent = "div"> =
  TextFieldPrimitive.TextFieldDescriptionProps<T> & {
    class?: string;
  };

const TextFieldDescription = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TextFieldDescriptionProps<T>>
) => {
  const [local, others] = splitProps(props as TextFieldDescriptionProps, ["class"]);

  return (
    <TextFieldPrimitive.Description
      class={cn("text-muted-foreground text-xs", local.class)}
      {...others}
    />
  );
};

type TextFieldErrorMessageProps<T extends ValidComponent = "div"> =
  TextFieldPrimitive.TextFieldErrorMessageProps<T> & {
    class?: string;
  };

const TextFieldErrorMessage = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, TextFieldErrorMessageProps<T>>
) => {
  const [local, others] = splitProps(props as TextFieldErrorMessageProps, ["class"]);

  return (
    <TextFieldPrimitive.ErrorMessage
      class={cn("animate-in slide-in-from-top-1 text-destructive text-xs", local.class)}
      {...others}
    />
  );
};

interface TextFieldControlProps extends ComponentProps<"div"> {
  class?: string;
}

const TextFieldControl: Component<TextFieldControlProps> = props => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <div
      class={cn(
        "bg-background border-input relative flex items-center rounded-lg border transition-all duration-200",
        "hover:border-ring/50",
        "focus-within:border-ring focus-within:ring-ring/10 focus-within:ring-4",
        "[&:has([data-invalid])]:border-destructive [&:has([data-invalid])]:focus-within:ring-destructive/10",
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  );
};

interface TextFieldSlotProps extends ComponentProps<"div"> {
  class?: string;
  position?: "left" | "right";
}

const TextFieldSlot: Component<TextFieldSlotProps> = props => {
  const [local, others] = splitProps(props, ["class", "position", "children"]);

  return (
    <div
      class={cn(
        "text-muted-foreground flex items-center transition-colors duration-200",
        local.position === "left" && "mr-2",
        local.position === "right" && "ml-2",
        local.class
      )}
      {...others}
    >
      {local.children}
    </div>
  );
};

interface TextFieldInputWrapperProps extends ComponentProps<"div"> {
  class?: string;
}

const TextFieldInputWrapper: Component<TextFieldInputWrapperProps> = props => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <div class={cn("relative flex-1", local.class)} {...others}>
      {local.children}
    </div>
  );
};

type InputProps = Omit<TextFieldInputProps, "type">;

const TextField = Object.assign(TextFieldRoot, {
  Label: TextFieldLabel,
  Description: TextFieldDescription,
  ErrorMessage: TextFieldErrorMessage,
  Input: TextFieldInput,
  TextArea: TextFieldTextArea,
  Control: TextFieldControl,
  Slot: TextFieldSlot,
  InputWrapper: TextFieldInputWrapper,
});

export {
  TextField,
  TextFieldControl,
  TextFieldDescription,
  TextFieldErrorMessage,
  TextFieldInput,
  TextFieldInputWrapper,
  TextFieldLabel,
  TextFieldRoot,
  TextFieldSlot,
  TextFieldTextArea,
};
export type {
  InputProps,
  TextFieldDescriptionProps,
  TextFieldErrorMessageProps,
  TextFieldInputProps,
  TextFieldLabelProps,
  TextFieldRootProps,
  TextFieldTextAreaProps,
};
