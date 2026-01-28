# ROADMAP

Ordered by most applicable tasks. Each task includes a reference to the exact plan lines to read first.

1) Implement storage + session bridge (Drizzle/libsql setup, schemas, UUIDv7 session flow, Mastra Memory wiring).
   Ref: `01-storage-session-bridge.md:L23-L146`

2) Build core Instance context system (AsyncLocalStorage context, Instance.provide, bootstrap, state, workspace detection).
   Ref: `new-architecture-plan.md:L185-L560`

3) Update core tools to respect Instance.directory (filesystem + shell + registry).
   Ref: `new-architecture-plan.md:L1389-L1715`

4) Add server middleware + core routes (directory context, auth, error handling, prompt + health endpoints, server wiring).
   Ref: `new-architecture-plan.md:L730-L1203`

5) Implement XState loop control + hierarchical machine design.
   Ref: `new-integration.md:L167-L520`

6) Implement XState actors + dynamic tool routing per phase.
   Ref: `new-integration.md:L739-L1145`

7) Add doom-loop detection guards.
   Ref: `new-integration.md:L1328-L1384`

8) Wire Plan/Build agents to HybridAgent (multimodal routing, directory-aware tools).
   Ref: `new-architecture-plan.md:L1770-L1793`

9) Implement Sequential Thinking tool and integrate into agent loops.
   Ref: `new-sequential-thinking.md:L91-L180`, `new-sequential-thinking.md:L489-L540`

10) Implement search_docs / better-context tool stack (core infra → AST → supporting tools → sub-agent → main tool).
    Ref: `new-better-context.md:L1230-L1272`

11) Implement Electron main + preload bridge (sidecar spawn/integration + IPC APIs).
    Ref: `new-architecture-plan.md:L1996-L2263`

12) Build Solid UIMessage chat UI (types → store → stream parser → hook → components).
    Ref: `new-solid-ai-integration.md:L406-L1131`
