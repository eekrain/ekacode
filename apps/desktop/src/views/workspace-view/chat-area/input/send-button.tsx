import { cn } from "@/utils";
import { Loader2, Send } from "lucide-solid";
import type { Accessor, Component } from "solid-js";

interface SendButtonProps {
  canSend: Accessor<boolean>;
  isSending: boolean;
  onClick: () => void;
}

export const SendButton: Component<SendButtonProps> = props => {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={!props.canSend()}
      class={cn(
        "rounded-lg p-2 transition-all duration-200",
        "flex items-center justify-center",
        !props.canSend() && "bg-muted/20 text-muted-foreground/50 cursor-not-allowed opacity-50",
        props.canSend() && "bg-primary text-primary-foreground hover:bg-primary/90"
      )}
      title="Send message"
      aria-label="Send"
    >
      {props.isSending ? <Loader2 class="h-4 w-4 animate-spin" /> : <Send class="h-4 w-4" />}
    </button>
  );
};
