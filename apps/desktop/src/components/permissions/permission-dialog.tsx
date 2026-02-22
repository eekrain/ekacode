/**
 * PermissionDialog - Modal for tool permission requests
 *
 * Displays when a tool requires user approval before execution.
 * Shows tool name, arguments, and allow/deny buttons.
 */
import type { PermissionRequestData } from "@/core/chat/types/ui-message";
import { cn } from "@/utils";
import { AlertTriangle, Check, Loader2 } from "lucide-solid";
import { Component, Show } from "solid-js";

interface PermissionDialogProps {
  /** The permission request to display (null = hidden) */
  request: PermissionRequestData | null;

  /** Called when user approves the request */
  onApprove: (id: string) => void;

  /** Called when user denies the request */
  onDeny: (id: string) => void;

  /** Loading state during API call */
  isResolving?: boolean;

  /** Additional CSS classes for the overlay */
  class?: string;
}

/**
 * Modal dialog for permission requests
 *
 * @example
 * ```tsx
 * <PermissionDialog
 *   request={permissions.currentRequest()}
 *   onApprove={(id) => permissions.approve(id)}
 *   onDeny={(id) => permissions.deny(id)}
 * />
 * ```
 */
export const PermissionDialog: Component<PermissionDialogProps> = props => {
  return (
    <Show when={props.request}>
      {request => (
        <div
          class={cn(
            "fixed inset-0 z-50",
            "flex items-center justify-center",
            "bg-black/50 backdrop-blur-sm",
            "animate-in fade-in duration-200",
            props.class
          )}
        >
          {/* Dialog card */}
          <div
            class={cn(
              "bg-card border-border border",
              "rounded-xl p-6 shadow-2xl",
              "mx-4 w-full max-w-lg",
              "animate-in zoom-in-95 duration-200"
            )}
          >
            {/* Header */}
            <div class="mb-4 flex items-start gap-3">
              {/* Warning icon */}
              <div class="shrink-0 rounded-full bg-amber-500/10 p-2">
                <AlertTriangle class="h-6 w-6 text-amber-500" />
              </div>

              <div class="min-w-0">
                <h2 class="text-foreground text-lg font-semibold">Permission Required</h2>
                <p class="text-muted-foreground mt-0.5 text-sm">
                  A tool requires your approval before execution
                </p>
              </div>
            </div>

            {/* Tool info */}
            <div class="mb-6 space-y-3">
              {/* Tool name */}
              <div class="flex items-center gap-2">
                <span class="text-muted-foreground text-sm">Tool:</span>
                <span class="bg-primary/10 text-primary rounded px-2 py-0.5 font-mono text-sm">
                  {request().toolName}
                </span>
              </div>

              {/* Arguments */}
              <Show when={request().args && Object.keys(request().args).length > 0}>
                <div>
                  <span class="text-muted-foreground mb-1.5 block text-sm">Arguments:</span>
                  <pre
                    class={cn(
                      "font-mono text-xs",
                      "rounded-lg p-3",
                      "bg-muted/50 border-border/50 border",
                      "max-h-40 overflow-x-auto"
                    )}
                  >
                    {JSON.stringify(request().args, null, 2)}
                  </pre>
                </div>
              </Show>

              {/* Description */}
              <Show when={request().description}>
                <div class="text-muted-foreground bg-muted/30 rounded-lg p-3 text-sm">
                  {request().description}
                </div>
              </Show>
            </div>

            {/* Actions */}
            <div class="flex items-center justify-end gap-3">
              {/* Deny button */}
              <button
                onClick={() => props.onDeny(request().id)}
                disabled={props.isResolving}
                class={cn(
                  "rounded-lg px-4 py-2",
                  "text-sm font-medium",
                  "bg-destructive/10 text-destructive",
                  "hover:bg-destructive/20",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "transition-colors duration-150"
                )}
              >
                Deny
              </button>

              {/* Approve button */}
              <button
                onClick={() => props.onApprove(request().id)}
                disabled={props.isResolving}
                class={cn(
                  "rounded-lg px-4 py-2",
                  "text-sm font-medium",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "transition-colors duration-150",
                  "flex items-center gap-2"
                )}
              >
                <Show when={!props.isResolving} fallback={<Loader2 class="h-4 w-4 animate-spin" />}>
                  <Check class="h-4 w-4" />
                </Show>
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default PermissionDialog;
