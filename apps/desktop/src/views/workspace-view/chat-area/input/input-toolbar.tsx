import type { AgentMode } from "@/core/chat/types";
import { AtSign, Paperclip } from "lucide-solid";
import type { Component } from "solid-js";

interface InputToolbarProps {
  mode: AgentMode;
  disabled: boolean;
  onMention: () => void;
  onAttachment: () => void;
  onModeChange: (mode: AgentMode) => void;
}

export const InputToolbar: Component<InputToolbarProps> = props => {
  const modeLabel = () => (props.mode === "plan" ? "Plan" : "Build");

  const toggleMode = () => {
    const nextMode: AgentMode = props.mode === "plan" ? "build" : "plan";
    props.onModeChange(nextMode);
  };

  return (
    <div class="flex items-center gap-1">
      <button
        type="button"
        onClick={props.onMention}
        disabled={props.disabled}
        class="text-muted-foreground/70 hover:text-primary hover:bg-muted/40 rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        title="@ mention files or symbols"
        aria-label="Mention"
      >
        <AtSign class="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={props.onAttachment}
        disabled={props.disabled}
        class="text-muted-foreground/70 hover:text-primary hover:bg-muted/40 rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        title="Attach file or image"
        aria-label="Attach"
      >
        <Paperclip class="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={toggleMode}
        disabled={props.disabled}
        class="text-muted-foreground/80 hover:text-primary hover:border-primary/40 border-border/40 hover:bg-muted/40 flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        title={`Switch to ${props.mode === "plan" ? "Build" : "Plan"} mode`}
      >
        {modeLabel()}
      </button>
    </div>
  );
};
