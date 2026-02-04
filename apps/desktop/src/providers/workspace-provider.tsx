/**
 * WorkspaceProvider - Context provider for workspace state
 *
 * Provides centralized state management for the workspace view including:
 * - Workspace path and project info
 * - API client instance
 * - Session list management
 * - Chat integration via useChat hook
 * - Permission handling
 *
 * This provider should wrap the entire workspace view.
 */
import { useParams } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onMount,
  useContext,
  type Accessor,
  type JSX,
  type ParentComponent,
} from "solid-js";
import { useChat, type UseChatResult } from "../hooks/use-chat";
import { usePermissions, type UsePermissionsResult } from "../hooks/use-permissions";
import { useSession } from "../hooks/use-session";
import { EkacodeApiClient, type SessionInfo } from "../lib/api-client";
import type { WorkspaceState } from "../types";

// ============================================================
// Types
// ============================================================

/**
 * Session with UI-specific properties
 */
export interface UISession extends SessionInfo {
  /** Display title (derived from first message or default) */
  title: string;
  /** Whether session is pinned */
  isPinned?: boolean;
  /** Status for UI rendering */
  status: "active" | "archived";
}

/**
 * Workspace context value
 */
export interface WorkspaceContextValue {
  // Workspace info
  workspace: Accessor<string>;
  projectId: Accessor<string>;
  projectName: Accessor<string>;

  // API client
  client: Accessor<EkacodeApiClient | null>;
  isClientReady: Accessor<boolean>;

  // Sessions
  sessions: Accessor<UISession[]>;
  activeSessionId: Accessor<string | null>;
  setActiveSessionId: (id: string | null) => void;
  createSession: () => Promise<string>;
  deleteSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  isLoadingSessions: Accessor<boolean>;

  // Chat (active session)
  chat: Accessor<UseChatResult | null>;

  // Permissions
  permissions: Accessor<UsePermissionsResult | null>;
}

// ============================================================
// Context
// ============================================================

const WorkspaceContext = createContext<WorkspaceContextValue>();

/**
 * Hook to access workspace context
 *
 * @throws Error if used outside WorkspaceProvider
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

// ============================================================
// Inner Hooks Component
// ============================================================

interface WorkspaceHooksProps {
  client: EkacodeApiClient;
  workspace: string;
  activeSessionId: Accessor<string | null>;
  setActiveSessionId: (id: string | null) => void;
  refreshSessions: () => void;
  onReady: (chat: UseChatResult, permissions: UsePermissionsResult) => void;
}

/**
 * Component that initializes hooks and provides them via context
 * This only renders when client and workspace are available
 */
function WorkspaceHooks(props: WorkspaceHooksProps) {
  const chat = useChat({
    client: props.client,
    workspace: () => props.workspace,
    initialSessionId: props.activeSessionId() ?? undefined,
    onSessionIdReceived: (id: string) => {
      if (id !== props.activeSessionId()) {
        props.setActiveSessionId(id);
        props.refreshSessions();
      }
    },
  });

  const permissions = usePermissions({
    client: props.client,
    workspace: () => props.workspace,
    sessionId: props.activeSessionId,
  });

  // Notify parent that hooks are ready
  onMount(() => {
    props.onReady(chat, permissions);
  });

  // Update parent when activeSessionId changes (to keep hooks in sync)
  createEffect(() => {
    // Sync happens through the callbacks, but we ensure the signal is tracked
    const _id = props.activeSessionId();
  });

  return null; // No visible output
}

// ============================================================
// Provider Component
// ============================================================

interface WorkspaceProviderProps {
  children: JSX.Element;
}

/**
 * WorkspaceProvider - Provides workspace state to children
 */
export const WorkspaceProvider: ParentComponent<WorkspaceProviderProps> = props => {
  const params = useParams<{ id: string }>();

  // ---- Workspace State ----
  const [workspaceState, setWorkspaceState] = createSignal<WorkspaceState | null>(null);

  // Load workspace state from sessionStorage
  onMount(() => {
    const stored = sessionStorage.getItem(`workspace:${params.id}`);
    if (stored) {
      try {
        setWorkspaceState(JSON.parse(stored));
      } catch {
        console.error("Failed to parse workspace state");
      }
    }
  });

  const workspace = createMemo(() => workspaceState()?.path ?? "");
  const projectId = createMemo(() => workspaceState()?.projectId ?? params.id);
  const projectName = createMemo(() => workspaceState()?.name ?? "Project");

  // ---- API Client ----
  const [client, setClient] = createSignal<EkacodeApiClient | null>(null);
  const isClientReady = createMemo(() => client() !== null);

  onMount(async () => {
    try {
      const config = await window.ekacodeAPI.server.getConfig();
      setClient(new EkacodeApiClient(config));
    } catch (error) {
      console.error("Failed to initialize API client:", error);
    }
  });

  // ---- Sessions ----
  const [serverSessions, setServerSessions] = createSignal<SessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = createSignal(false);

  // Transform server sessions to UI sessions
  const sessions = createMemo<UISession[]>(() => {
    return serverSessions().map((session, index) => ({
      ...session,
      title: `Session ${index + 1}`, // TODO: Store/fetch title from first message
      status: "active" as const,
    }));
  });

  // Session management via useSession hook
  const sessionHook = useSession({
    workspace,
  });

  const activeSessionId = sessionHook.sessionId;
  const setActiveSessionId = sessionHook.setSessionId;

  /**
   * Fetch sessions from server
   */
  const refreshSessions = async () => {
    const c = client();
    if (!c) return;

    setIsLoadingSessions(true);
    try {
      const list = await c.listSessions();
      setServerSessions(list);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Load sessions when client is ready
  createEffect(() => {
    if (isClientReady()) {
      refreshSessions();
    }
  });

  /**
   * Create a new session
   * Returns the new session ID
   */
  const createSession = async (): Promise<string> => {
    // Clear the current session to force server to create new one
    setActiveSessionId(null);

    // The next chat message will create a new session
    // For now, just return a temporary ID
    const tempId = `temp-${Date.now()}`;
    return tempId;
  };

  /**
   * Delete a session
   */
  const deleteSession = async (id: string): Promise<void> => {
    const c = client();
    if (!c) return;

    try {
      await c.deleteSession(id);
      // Refresh the list
      await refreshSessions();
      // If deleted session was active, clear it
      if (activeSessionId() === id) {
        setActiveSessionId(null);
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  // ---- Chat & Permissions Hooks ----
  const [chatResult, setChatResult] = createSignal<UseChatResult | null>(null);
  const [permissionsResult, setPermissionsResult] = createSignal<UsePermissionsResult | null>(null);

  // ---- Context Value ----
  const contextValue: WorkspaceContextValue = {
    // Workspace
    workspace,
    projectId,
    projectName,

    // Client
    client,
    isClientReady,

    // Sessions
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    refreshSessions,
    isLoadingSessions,

    // Chat
    chat: chatResult,

    // Permissions
    permissions: permissionsResult,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {props.children}
      {/* Initialize hooks when client and workspace are ready */}
      {(() => {
        const c = client();
        const ws = workspace();
        if (!c || !ws) return null;

        return (
          <WorkspaceHooks
            client={c}
            workspace={ws}
            activeSessionId={activeSessionId}
            setActiveSessionId={setActiveSessionId}
            refreshSessions={refreshSessions}
            onReady={(chat, permissions) => {
              setChatResult(chat);
              setPermissionsResult(permissions);
            }}
          />
        );
      })()}
    </WorkspaceContext.Provider>
  );
};

export default WorkspaceProvider;
