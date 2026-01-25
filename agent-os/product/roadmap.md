# Product Roadmap

## Phase 1: MVP

### Core Agent Capabilities

- **Recursive planning workflows**: Multi-agent architecture with `build`, `plan`, `general`, and `explore` agents; workflows for planning and coding with self-healing loops (test → fail → fix → pass).
- **Code understanding**: LSP or Compiler API integration for go-to-definition, find-references, diagnostics, and document symbols.
- **Core tools**: Filesystem (read, write, edit, ls, glob), shell (bash with streaming), git (status, diff, commit), and search tools (grep, codesearch, webfetch).
- **Memory layer**: libSQL-based memory store with types (best_practice, anti_pattern, gotcha, heuristic, example), confidence scoring, topic filtering, and scope (global/project).
- **Tool approval flow**: Human-in-the-loop approvals for write/delete/run operations; UI shows pending tool calls with diff previews and Approve/Decline actions.

### Task & Memory Management

- **Task graph system**: Durable, git-backed task storage with dependency tracking, atomic tasks, and `bd ready` queries to get zero-blocking-dependency tasks.
- **Context rot safeguards**: Compaction (LLM summaries of completed batches), confidence decay over time, and per-project memory namespaces.
- **Memory retrieval tool**: `recall_best_practices` with semantic search (embeddings + metadata filters), min confidence threshold, and topic filtering.

### UI & Workspace

- **Workspace/Project/Session hierarchy**:
  - Workspaces: Manage multi-agent configurations and preferences.
  - Projects: List of projects being worked on.
  - Sessions: Per-project sessions; session types (spec/plan mode vs. fast/build mode) visible in UI.
  - Chat history: Persistent conversation history per session with message threads and tool call expansion.
- **Intuitive UI**:
  - Chat message list with virtual scrolling and code block rendering (syntax highlighting, copy/insert).
  - Tool output panel with streaming logs and copy/save.
  - Status indicators: streaming, waiting approval, running tool, stopped, error.
  - Sidebar: Thread history, agent selector, settings button.
  - Settings modal: Model selection (provider + model), temperature, max tokens, workspace path picker, telemetry toggle.
  - Diff preview for file edits before apply; apply/diff confirmation dialog.

### Desktop Integration

- **Secure Electron setup**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **IPC bridge**: Minimal preload API via `contextBridge` for `getServerConfig()`, `onFsEvent()`, native dialogs; no raw `ipcRenderer` exposed.
- **File watching**: Chokidar watch on workspace; IPC push events to renderer on external file changes.
- **Internal Hono server**: Loopback-only (127.0.0.1/::1) on random port; ephemeral bearer token generated at startup; auth middleware rejecting missing/invalid tokens.

### Streaming & Reliability

- **SSE bridge**: `/api/chat` endpoint mapping Mastra events to TanStack AI StreamChunks (text-delta → content, tool-call → tool_call, tool-result → tool_result, approval-requested → approval-requested, finish → done, errors → error).
- **Cancellation/Stop**: AbortSignal support that aborts LLM and terminates child processes.
- **Reconnection**: SSE connection stability with backoff; graceful error handling and recovery flows.
- **Observability**: Structured logs (jsonl with rotation) for tools, agent events, and approvals.

## Phase 2: Post-Launch

### Advanced Agent Features

- **Multi-agent orchestration**: Enhanced workflows with parallel primitives, explicit branching, and nested workflows.
- **TDD enforcement**: Automated test → fail → fix → pass loops in coding workflow.
- **Workflow orchestration**: Mastra vNext workflows with step-by-step execution, planning workflows, and self-healing.

### Enhanced Memory

- **Query rewriting**: LLM-expands user queries to improve recall (multiple semantic queries merged).
- **Hybrid search**: Vector search + symbolic filters (topic, tags, confidence, scope) for precise retrieval.
- **Confidence reinforcement**: User "this helped" feedback boosts confidence; automatic memory extraction from git diffs.
- **Memory review UI**: Browse and manage memories, mark deprecated, adjust confidence, view analytics.

### MCP Integration

- **MCP server registry**: Dynamic loading of stdio MCP servers.
- **Built-in MCP servers**: filesystem-mcp-server, github-mcp-server (optional).
- **Chrome DevTools MCP**: Direct inspection, testing, and debugging of web applications.

### Polish & Production

- **Error handling**: Structured error responses, user-friendly messages, error recovery flows.
- **Performance**: Virtual scrolling for long conversations, lazy code highlighter, cached LSP responses, debounced file watcher.
- **Testing**: Unit tests, integration tests, E2E tests (Playwright), agent behavior tests.
- **Documentation**: User guide, developer docs, API docs (OpenAPI), contributing guidelines.
- **Packaging**: electron-builder with code signing (macOS/Windows), auto-update infrastructure, distribution (Homebrew, Scoop, AUR).
