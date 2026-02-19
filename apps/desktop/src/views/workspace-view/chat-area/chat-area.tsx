import { type ModelSelectorSection } from "@/components/model-selector";
import { useFileSearch, useSessionTurns } from "@/core/chat/hooks";
import { type AgentMode } from "@/core/chat/types";
import { usePermissions } from "@/core/permissions/hooks/use-permissions";
import { useChatContext } from "@/state/contexts/chat-provider";
import {
  usePermissionStore,
  useProviderSelectionStore,
  useQuestionStore,
  useWorkspace,
} from "@/state/providers";
import { cn } from "@/utils";
import Resizable from "@corvu/resizable";
import { Component, Show, createMemo, createSignal } from "solid-js";
import {
  ChatInput,
  type ChatInputModelOption,
  type PendingPermissionBannerData,
} from "./input/chat-input";
import { ChatPerfPanel } from "./perf/chat-perf-panel";
import { MessageTimeline } from "./timeline/message-timeline";

export interface ChatAreaProps {
  class?: string;
}

export const ChatArea: Component<ChatAreaProps> = props => {
  const ctx = useWorkspace();
  const { chat } = useChatContext();
  const providerSelection = useProviderSelectionStore();
  const [permissionState] = usePermissionStore();
  const [questionState, questionActions] = useQuestionStore();

  const fileSearch = useFileSearch(ctx.workspace);

  const isGenerating = () =>
    chat.streaming.status() === "connecting" || chat.streaming.status() === "streaming";

  const effectiveSessionId = createMemo(() => chat.sessionId() ?? ctx.activeSessionId());
  const turns = useSessionTurns(effectiveSessionId);

  const permissions = usePermissions({
    client: ctx.client()!,
    workspace: ctx.workspace,
    sessionId: effectiveSessionId,
  });

  const currentPendingPermission = createMemo(() => {
    const sessionId = effectiveSessionId();
    if (!sessionId) return undefined;
    const nextId = permissionState.pendingOrder.find(
      id => permissionState.byId[id]?.sessionID === sessionId
    );
    return nextId ? permissionState.byId[nextId] : undefined;
  });

  const currentPendingQuestion = createMemo(() => {
    const sessionId = effectiveSessionId();
    if (!sessionId) return undefined;
    const nextId = questionState.pendingOrder.find(
      id => questionState.byId[id]?.sessionID === sessionId
    );
    return nextId ? questionState.byId[nextId] : undefined;
  });

  const isPromptBlocked = createMemo(
    () => Boolean(currentPendingPermission()) || Boolean(currentPendingQuestion())
  );

  const pendingPermissionBanner = createMemo(() => {
    const pending = currentPendingPermission();
    if (!pending) return null;
    return {
      id: pending.id,
      toolName: pending.toolName,
      description: pending.description,
      patterns: pending.patterns,
    };
  });

  const handleApprovePermission = (id: string, patterns?: string[]) => {
    void permissions.approve(id, patterns);
  };

  const handleDenyPermission = (id: string) => {
    void permissions.deny(id);
  };

  const handleAnswerQuestion = (id: string, answer: unknown) => {
    questionActions.answer(id, answer);
  };

  const handleRejectQuestion = (id: string) => {
    questionActions.answer(id, { rejected: true });
  };

  const [agentMode, setAgentMode] = createSignal<AgentMode>("plan");

  const modelOptions = createMemo<ChatInputModelOption[]>(() =>
    providerSelection.docs().map(model => ({
      id: model.id,
      providerId: model.providerId,
      name: model.name,
      connected: model.connected,
    }))
  );

  const selectedModel = createMemo(
    () => providerSelection.data()?.preferences.selectedModelId ?? ""
  );

  const connectedModelOptions = (query: string): ChatInputModelOption[] =>
    providerSelection.connectedResults(query).map(mapDocToOption);

  const notConnectedModelOptions = (query: string): ChatInputModelOption[] =>
    providerSelection.notConnectedResults(query).map(mapDocToOption);

  const modelSections = (query: string): ModelSelectorSection[] =>
    providerSelection.providerGroupedSections(query).map(section => ({
      providerId: section.providerId,
      providerName: section.providerName,
      connected: section.connected,
      models: section.models.map(mapDocToOption),
    }));

  const mapDocToOption = (model: {
    id: string;
    providerId: string;
    providerName?: string;
    name?: string;
    connected: boolean;
  }): ChatInputModelOption => ({
    id: model.id,
    providerId: model.providerId,
    providerName: model.providerName,
    name: model.name,
    connected: model.connected,
  });

  const handleModelChange = (modelId: string) => {
    const selected = modelOptions().find(model => model.id === modelId);
    if (!selected) return;
    void providerSelection.setSelectedModel(selected.id).catch(error => {
      console.error("Failed to persist provider preferences:", error);
    });
  };

  const handleSendMessage = async () => {
    const content = draftMessage().trim();
    if (!content || isGenerating() || isPromptBlocked()) return;
    await chat.sendMessage(content);
    setDraftMessage("");
  };

  const [draftMessage, setDraftMessage] = createSignal("");

  return (
    <Resizable.Panel
      initialSize={0.5}
      minSize={0.2}
      class={cn("bg-background relative flex h-full min-h-0 flex-1 flex-col", props.class)}
    >
      <div class={cn("flex h-full min-h-0 w-full flex-1 flex-col")}>
        <Show when={import.meta.env.DEV}>
          <ChatPerfPanel />
        </Show>

        <MessageTimeline
          turns={turns}
          isStreaming={isGenerating}
          onPermissionApprove={handleApprovePermission}
          onPermissionDeny={handleDenyPermission}
          onQuestionAnswer={handleAnswerQuestion}
          onQuestionReject={handleRejectQuestion}
        />

        <div class="border-border/30 shrink-0 border-x border-t p-4">
          <ChatInput
            value={draftMessage()}
            onValueChange={setDraftMessage}
            onSend={handleSendMessage}
            mode={agentMode()}
            onModeChange={setAgentMode}
            selectedModel={selectedModel()}
            modelOptions={modelOptions()}
            getModelSections={modelSections}
            getConnectedModelOptions={connectedModelOptions}
            getNotConnectedModelOptions={notConnectedModelOptions}
            onModelChange={handleModelChange}
            isSending={isGenerating()}
            disabled={isPromptBlocked()}
            pendingPermission={pendingPermissionBanner()}
            onPermissionApproveOnce={handleApprovePermission}
            onPermissionApproveAlways={handleApprovePermission}
            onPermissionDeny={handleDenyPermission}
            placeholder="Send a message..."
            workspace={ctx.workspace()}
            getFileSearchResults={query =>
              fileSearch.search(query).then(() => fileSearch.results())
            }
          />
        </div>
      </div>
    </Resizable.Panel>
  );
};

export { type ChatInputModelOption, type PendingPermissionBannerData };
