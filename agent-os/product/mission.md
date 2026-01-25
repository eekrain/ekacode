# Product Mission

## Problem

Current AI coding assistants and agents suffer from several critical limitations that erode developer trust and productivity:

- **Context rot**: As conversations grow, earlier decisions and context get lost in the "middle" of the prompt window, leading the agent to forget important constraints, import non-existent symbols, or repeat mistakes.
- **Opaque actions**: Most tools show final outputs without intermediate tool execution progress, making it hard to understand what the agent is doing or catch mistakes early.
- **Hallucinated imports/symbols**: Agents remember functions from files read long ago that no longer exist, leading to broken code.
- **No durable memory**: Every session starts fresh, losing valuable insights, patterns, and project-specific rules learned over time.
- **Poor code understanding**: RAG systems often miss type information, call relationships, and semantic structure, resulting in superficial recommendations.
- **Weak planning**: Many agents operate in a reactive "fix-and-repeat" mode without a coherent plan or iterative refinement.

## Target Users

ekacode is designed for:

- **Solo developers** building full-stack applications who want an agent that can plan, execute, and self-correct.
- **Team developers** integrating AI agents into workflows with approval flows and auditability.
- **Code reviewers** inspecting diffs and logs to validate agent actions before merging.
- **Engineering teams** maintaining large TypeScript/JavaScript codebases who need reliable automated refactoring and feature development.

## Solution

ekacode addresses these problems through a principled, offline-first architecture:

- **Recursive planning agents**: Multi-step workflows (Plan → Code → Test → Review) with self-healing loops that retry until tests pass or iteration limits are reached.
- **Context rot safeguards**: A robust tasks/memory system with compaction, confidence decay, and project-scoped namespaces to keep the context window focused on the active frontier of work.
- **Deterministic code understanding**: TypeScript Compiler API + Tree-sitter for accurate type information, call graph traversal, and semantic code search via embeddings.
- **Transparent tooling**: Streaming tool outputs with progress indicators, approval flows for risky operations, and structured JSON responses (exit codes, durations, diffs).
- **Integrated debugging**: Direct web viewer and Chrome DevTools MCP integration so the agent can inspect, test, and debug applications in real time.
- **Long-term memory**: Persistent storage of best practices, anti-patterns, and project rules (libSQL) that the agent retrieves contextually via semantic search and symbolic filters.
- **Secure, local-first**: Electron app with sandboxed renderer, loopback-only Hono server with bearer token auth, and no external dependencies except LLM endpoints.
