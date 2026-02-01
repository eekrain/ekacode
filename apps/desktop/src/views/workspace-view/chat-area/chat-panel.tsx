import Resizable from "@corvu/resizable";
import { Component, createSignal, mergeProps } from "solid-js";
import { ChatHeader } from ".//chat-header";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { cn } from "/@/lib/utils";
import type { Message, Session } from "/@/types";

interface ChatPanelProps {
  /** Current active session */
  session?: Session;
  /** All messages for current session */
  messages?: Message[];
  /** Whether AI is currently generating */
  isGenerating?: boolean;
  /** Current thinking content */
  thinkingContent?: string;
  /** Send message handler */
  onSend?: (content: string) => void;
  /** Attachment handler */
  onAttachment?: () => void;
  /** Mention handler */
  onMention?: () => void;
  /** Model change handler */
  onModelChange?: (modelId: string) => void;
  /** Selected model ID */
  selectedModel?: string;
  /** Additional CSS classes */
  class?: string;
}

/**
 * ChatPanel - Center panel composing the full chat interface
 *
 * Design Features:
 * - Breadcrumb navigation in header
 * - Scrollable message area with auto-scroll
 * - Floating input with glass-morphic design
 * - Smooth transitions between states
 */
export const ChatPanel: Component<ChatPanelProps> = props => {
  const merged = mergeProps(
    {
      messages: [],
      isGenerating: false,
      selectedModel: "claude-sonnet",
    },
    props
  );

  const [inputValue, setInputValue] = createSignal("");

  const handleSend = () => {
    const content = inputValue().trim();
    if (content && !merged.isGenerating) {
      merged.onSend?.(content);
      setInputValue("");
    }
  };

  // Generate breadcrumbs from session/project path
  const breadcrumbs = () => {
    const path = props.session?.projectId || "~/ekacode";
    return path.split("/").map((segment, index, array) => ({
      label: segment || "~",
      path: array.slice(0, index + 1).join("/"),
    }));
  };

  return (
    <Resizable.Panel initialSize={0.5} minSize={0.3} class="overflow-visible">
      <div class={cn("bg-background animate-fade-in-up flex h-full flex-col", props.class)}>
        {/* Header */}
        <ChatHeader
          breadcrumbs={breadcrumbs()}
          projectName={props.session?.projectId}
          selectedModel={merged.selectedModel}
          onModelChange={props.onModelChange}
        />

        {/* Message list */}
        <MessageList
          messages={merged.messages}
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
          isSending={merged.isGenerating}
          placeholder={
            props.session?.messages.length === 0
              ? "Start a conversation about your project..."
              : "Continue the conversation..."
          }
        />
      </div>
    </Resizable.Panel>
  );
};
