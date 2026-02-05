import Resizable from "@corvu/resizable";
import { Component, createSignal, mergeProps, Show } from "solid-js";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { StreamDebuggerPanel } from "./stream-debugger-panel";
import type { UseStreamDebuggerResult } from "/@/hooks/use-stream-debugger";
import { cn } from "/@/lib/utils";
import type { AgentMode, Session } from "/@/types";
import type { ChatUIMessage } from "/@/types/ui-message";

interface ChatPanelProps {
  /** Current active session */
  session?: Session | { sessionId: string; title: string };
  /** All messages for current session */
  messages?: ChatUIMessage[];
  /** Whether AI is currently generating */
  isGenerating?: boolean;
  /** Current thinking content */
  thinkingContent?: string;
  /** Current error if any */
  error?: Error | null;
  /** Send message handler */
  onSend?: (content: string) => void;
  /** Attachment handler */
  onAttachment?: () => void;
  /** Mention handler */
  onMention?: () => void;
  /** Mode change handler */
  onModeChange?: (mode: AgentMode) => void;
  /** Model change handler */
  onModelChange?: (modelId: string) => void;
  /** Selected model ID */
  selectedModel?: string;
  /** Initial mode */
  initialMode?: AgentMode;
  /** Stream debugger instance (optional) */
  streamDebugger?: UseStreamDebuggerResult;
  /** Additional CSS classes */
  class?: string;
}

/**
 * ChatPanel - Center panel composing the full chat interface
 *
 * Design Features:
 * - Breadcrumb navigation in header
 * - Scrollable message area with auto-scroll
 * - Clean card-style input with mode selector
 * - Smooth transitions between states
 * - Stream debugger toggle for development
 */
export const ChatPanel: Component<ChatPanelProps> = props => {
  const merged = mergeProps(
    {
      messages: [],
      isGenerating: false,
      selectedModel: "claude-sonnet",
      initialMode: "plan" as AgentMode,
    },
    props
  );

  const [inputValue, setInputValue] = createSignal("");
  const [agentMode, setAgentMode] = createSignal<AgentMode>(merged.initialMode);
  const [showDebugger, setShowDebugger] = createSignal(false);

  const handleSend = () => {
    const content = inputValue().trim();
    if (content && !merged.isGenerating) {
      merged.onSend?.(content);
      setInputValue("");
    }
  };

  const handleModeChange = (mode: AgentMode) => {
    setAgentMode(mode);
    merged.onModeChange?.(mode);
  };

  const handleToggleDebugger = () => {
    setShowDebugger(!showDebugger());
  };

  // Get project name from session (handle both formats)
  const getProjectName = (): string => {
    const session = props.session;
    if (!session) return "Project";
    if ("projectId" in session) return session.projectId ?? "Project";
    return session.title ?? "Project";
  };

  // Generate breadcrumbs from session/project path
  const breadcrumbs = () => {
    const path = getProjectName();
    return path.split("/").map((segment: string, index: number, array: string[]) => ({
      label: segment || "~",
      path: array.slice(0, index + 1).join("/"),
    }));
  };

  // Get placeholder text
  const getPlaceholder = (): string => {
    const messageCount = merged.messages?.length ?? 0;
    return messageCount === 0 ? "Start a conversation about your project..." : "Reply to Agent...";
  };

  return (
    <Resizable.Panel
      initialSize={0.5}
      minSize={0.3}
      class={cn(
        "bg-background animate-fade-in-up flex h-full flex-1 flex-col overflow-visible",
        props.class
      )}
    >
      {/* Header */}
      <ChatHeader
        breadcrumbs={breadcrumbs()}
        projectName={getProjectName()}
        selectedModel={merged.selectedModel}
        onModelChange={props.onModelChange}
        isDebuggerOpen={showDebugger()}
        onToggleDebugger={handleToggleDebugger}
      />

      {/* Error banner */}
      <Show when={props.error}>
        <div class="bg-destructive/10 border-destructive/20 mx-4 mt-2 rounded-lg border px-4 py-3">
          <div class="flex items-start gap-3">
            <svg
              class="text-destructive mt-0.5 h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="flex-1">
              <p class="text-destructive text-sm font-medium">Error</p>
              <p class="text-destructive/80 mt-1 text-sm">{props.error?.message}</p>
            </div>
          </div>
        </div>
      </Show>

      {/* Main content - either MessageList or Debugger */}
      <Show
        when={showDebugger() && props.streamDebugger}
        fallback={
          <>
            {/* Message list */}
            <MessageList
              messages={merged.messages as ChatUIMessage[]}
              isGenerating={merged.isGenerating}
              thinkingContent={props.thinkingContent}
            />

            {/* Input area */}
            <ChatInput
              value={inputValue()}
              onValueChange={setInputValue}
              onSend={handleSend}
              onAttachment={props.onAttachment}
              onMention={props.onMention}
              mode={agentMode()}
              onModeChange={handleModeChange}
              selectedModel={merged.selectedModel}
              isSending={merged.isGenerating}
              placeholder={getPlaceholder()}
            />
          </>
        }
      >
        <StreamDebuggerPanel debugger={props.streamDebugger!} onClose={handleToggleDebugger} />
      </Show>
    </Resizable.Panel>
  );
};
