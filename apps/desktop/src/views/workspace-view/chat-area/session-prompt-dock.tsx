import type { PermissionRequest } from "@/core/state/stores/permission-store";
import type { QuestionRequest } from "@/core/state/stores/question-store";
import { PermissionPart } from "@/views/workspace-view/chat-area/parts/permission-part";
import { QuestionPart } from "@/views/workspace-view/chat-area/parts/question-part";
import { Show, type Component } from "solid-js";

export interface SessionPromptDockProps {
  pendingPermission?: PermissionRequest;
  pendingQuestion?: QuestionRequest;
  onPermissionApprove?: (id: string, patterns?: string[]) => void | Promise<void>;
  onPermissionDeny?: (id: string) => void | Promise<void>;
  onQuestionAnswer?: (id: string, answer: unknown) => void | Promise<void>;
  onQuestionReject?: (id: string) => void | Promise<void>;
}

export const SessionPromptDock: Component<SessionPromptDockProps> = props => {
  const hasPendingPrompt = () => Boolean(props.pendingQuestion) || Boolean(props.pendingPermission);

  return (
    <Show when={hasPendingPrompt()}>
      <div
        data-component="session-prompt-dock"
        class="pointer-events-none absolute inset-x-0 bottom-0 z-50 px-4 pb-4"
      >
        <div class="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col gap-3">
          <Show when={props.pendingQuestion} keyed>
            {request => (
              <div
                data-component="tool-part-wrapper"
                data-question="true"
                class="shadow-background/40 rounded-lg shadow-xl"
              >
                <QuestionPart
                  part={{
                    type: "question",
                    request,
                  }}
                  onQuestionAnswer={props.onQuestionAnswer}
                  onQuestionReject={props.onQuestionReject}
                />
              </div>
            )}
          </Show>

          <Show when={props.pendingPermission} keyed>
            {request => (
              <div
                data-component="tool-part-wrapper"
                data-permission="true"
                class="shadow-background/40 rounded-lg shadow-xl"
              >
                <PermissionPart
                  part={{
                    type: "permission",
                    request,
                  }}
                  onPermissionApprove={props.onPermissionApprove}
                  onPermissionDeny={props.onPermissionDeny}
                />
              </div>
            )}
          </Show>
        </div>
      </div>
    </Show>
  );
};
