import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { cn } from "/@/lib/utils";
import type { DiffChange, FileTab, TerminalOutput } from "/@/types";

// Import workspace components
import Resizable from "@corvu/resizable";
import { ResizeableHandle } from "@renderer/components/resizeable-handle";
import { ChatPanel } from "./chat-area/chat-area";
import { LeftSide } from "./left-side/left-side";
import { ContextPanel } from "./right-side/right-side";
import { PermissionDialog } from "/@/components/permission-dialog";
import { useChat } from "/@/hooks/use-chat";
import { usePermissions } from "/@/hooks/use-permissions";
import type { EkacodeApiClient } from "/@/lib/api-client";
import { SyncProvider } from "/@/providers/sync-provider";
import { useWorkspace, WorkspaceProvider } from "/@/providers/workspace-provider";

/**
 * WorkspaceViewContent - The actual content wrapped by provider
 */
function WorkspaceViewContent() {
  const ctx = useWorkspace();

  // Panel sizes
  const [panelSizes, setPanelSizes] = createSignal<number[]>([0.2, 0.5, 0.3]);

  // Right panel state (still local for now)
  const [activeTopTab, setActiveTopTab] = createSignal<"files" | "diff">("files");
  const [openFiles, setOpenFiles] = createSignal<FileTab[]>([
    {
      id: "file-1",
      path: "/src/App.tsx",
      name: "App.tsx",
      isModified: false,
      isActive: true,
    },
  ]);
  const [diffChanges, setDiffChanges] = createSignal<DiffChange[]>([]);
  const [terminalOutput, setTerminalOutput] = createSignal<TerminalOutput[]>([
    {
      timestamp: new Date(),
      type: "info",
      content: "Workspace initialized",
    },
  ]);

  // Loading state
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(() => {
    const storedSizes = localStorage.getItem("ekacode-panel-sizes");
    if (storedSizes) {
      try {
        setPanelSizes(JSON.parse(storedSizes));
      } catch (error) {
        console.error("Failed to parse panel sizes:", error);
      }
    }
    setIsLoading(false);
  });

  createEffect(() => {
    localStorage.setItem("ekacode-panel-sizes", JSON.stringify(panelSizes()));
  });

  // Session handlers
  const handleNewSession = async () => {
    await ctx.createSession();
  };

  const handleSessionClick = (session: { sessionId?: string }) => {
    if (session.sessionId) {
      ctx.setActiveSessionId(session.sessionId);
    }
  };

  const handleTogglePin = () => {
    // TODO: Implement pin toggle with server
    console.log("Toggle pin not implemented yet");
  };

  // Chat handlers - delegate to context
  const handleSendMessage = async (content: string) => {
    const chat = ctx.chat();
    if (chat) {
      await chat.sendMessage(content);
    }
  };

  const handleModelChange = (modelId: string) => {
    // TODO: Store model preference
    console.log("Model changed to:", modelId);
  };

  // File/diff handlers
  const handleTabClick = (tab: FileTab) => {
    setOpenFiles(prev =>
      prev.map(t => ({
        ...t,
        isActive: t.id === tab.id,
      }))
    );
  };

  const handleTabClose = (tab: FileTab) => {
    setOpenFiles(prev => {
      const filtered = prev.filter(t => t.id !== tab.id);
      if (tab.isActive && filtered.length > 0) {
        filtered[filtered.length - 1].isActive = true;
      }
      return filtered;
    });
  };

  const handleAcceptDiff = (change: DiffChange) => {
    setDiffChanges(prev =>
      prev.map(c => (c.id === change.id ? { ...c, status: "accepted" as const } : c))
    );
  };

  const handleRejectDiff = (change: DiffChange) => {
    setDiffChanges(prev =>
      prev.map(c => (c.id === change.id ? { ...c, status: "rejected" as const } : c))
    );
  };

  const handleAcceptAllDiffs = () => {
    setDiffChanges(prev =>
      prev.map(c => (c.status === "pending" ? { ...c, status: "accepted" as const } : c))
    );
  };

  const handleRejectAllDiffs = () => {
    setDiffChanges(prev =>
      prev.map(c => (c.status === "pending" ? { ...c, status: "rejected" as const } : c))
    );
  };

  const handleClearTerminal = () => {
    setTerminalOutput([]);
  };

  const isGenerating = () => ctx.chat()?.isLoading() ?? false;
  const chatError = () => ctx.chat()?.error() ?? null;
  const activeSession = () => {
    const id = ctx.activeSessionId();
    return ctx.sessions().find(s => s.sessionId === id);
  };

  // Permission dialog
  const currentPermission = () => ctx.permissions()?.currentRequest() ?? null;
  const handleApprovePermission = (id: string) => {
    ctx.permissions()?.approve(id);
  };
  const handleDenyPermission = (id: string) => {
    ctx.permissions()?.deny(id);
  };

  return (
    <div class="bg-background h-screen flex-col overflow-hidden">
      {/* Loading state */}
      <Show when={isLoading()}>
        <div class="flex h-full items-center justify-center">
          <div class={cn("flex flex-col items-center gap-4", "animate-fade-in-up")}>
            <div class="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
              <svg
                class="text-primary h-6 w-6 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width={2}
                  d="M6 14 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"
                />
              </svg>
            </div>
            <p class="text-muted-foreground text-sm">Loading workspace...</p>
          </div>
        </div>
      </Show>

      {/* Main workspace with corvu resizable layout */}
      <Show when={!isLoading()}>
        <Resizable
          sizes={panelSizes()}
          onSizesChange={setPanelSizes}
          class="flex h-full w-full overflow-hidden"
        >
          <LeftSide
            sessions={ctx.sessions()}
            activeSessionId={ctx.activeSessionId() ?? undefined}
            onSessionClick={handleSessionClick}
            onNewSession={handleNewSession}
            onTogglePin={handleTogglePin}
            isLoading={ctx.isLoadingSessions()}
          />

          {/* Resize Handle 1 */}
          <ResizeableHandle />

          {/* CENTER PANEL - Chat Interface */}
          <ChatPanel
            session={activeSession()}
            sessionId={ctx.activeSessionId() ?? undefined}
            isGenerating={isGenerating()}
            thinkingContent={""}
            error={chatError()}
            onSend={handleSendMessage}
            onModelChange={handleModelChange}
            selectedModel="claude-sonnet"
            streamDebugger={ctx.chat()?.streamDebugger}
          />

          {/* Resize Handle 2 */}
          <ResizeableHandle />

          {/* RIGHT PANEL - Context & Terminal */}
          <ContextPanel
            openFiles={openFiles()}
            diffChanges={diffChanges()}
            terminalOutput={terminalOutput()}
            activeTopTab={activeTopTab}
            onActiveTopTabChange={tab => setActiveTopTab(tab)}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onAcceptDiff={handleAcceptDiff}
            onRejectDiff={handleRejectDiff}
            onAcceptAllDiffs={handleAcceptAllDiffs}
            onRejectAllDiffs={handleRejectAllDiffs}
            onClearTerminal={handleClearTerminal}
          />
        </Resizable>
      </Show>

      {/* Permission Dialog */}
      <PermissionDialog
        request={currentPermission()}
        onApprove={handleApprovePermission}
        onDeny={handleDenyPermission}
      />
    </div>
  );
}

/**
 * WorkspaceView - Main 3-column AI-native workspace interface
 *
 * Architecture (Luminous Workspace Design):
 * - Left Panel (~20%): Session Manager
 * - Center (~50%): Agent Chat Interface
 * - Right (~30%): Context & Terminal split vertically
 *
 * Provider Nesting:
 * GlobalSDKProvider → GlobalSyncProvider → App → WorkspaceView
 *   → WorkspaceProvider → SyncProvider → WorkspaceViewContent
 */
export default function WorkspaceView() {
  return (
    <WorkspaceProvider>
      {/* SyncProvider needs directory from workspace context */}
      <WorkspaceViewWithSync />
    </WorkspaceProvider>
  );
}

/**
 * Inner component that has access to workspace context
 */
function WorkspaceViewWithSync() {
  const ctx = useWorkspace();
  const directory = createMemo(() => ctx.workspace());

  return (
    <Show when={directory()} keyed>
      {currentDirectory => (
        <SyncProvider directory={currentDirectory}>
          <Show when={ctx.client()} keyed>
            {client => <WorkspaceHooksBridge client={client} workspace={currentDirectory} />}
          </Show>
          <WorkspaceViewContent />
        </SyncProvider>
      )}
    </Show>
  );
}

function WorkspaceHooksBridge(props: { client: EkacodeApiClient; workspace: string }) {
  const ctx = useWorkspace();

  const chat = useChat({
    client: props.client,
    workspace: () => props.workspace,
    initialSessionId: ctx.activeSessionId() ?? undefined,
    sessionId: ctx.activeSessionId,
    onSessionIdReceived: (id: string) => {
      if (id !== ctx.activeSessionId()) {
        ctx.setActiveSessionId(id);
        void ctx.refreshSessions();
      }
    },
  });

  const permissions = usePermissions({
    client: props.client,
    workspace: () => props.workspace,
    sessionId: ctx.activeSessionId,
  });

  createEffect(() => {
    ctx.setChat(chat);
    ctx.setPermissions(permissions);
  });

  onCleanup(() => {
    ctx.setChat(null);
    ctx.setPermissions(null);
  });

  return null;
}
