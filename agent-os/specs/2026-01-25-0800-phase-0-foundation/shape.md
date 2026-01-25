# Phase 0 Shaping Notes

## Scope

**In Scope:**

- Turborepo monorepo setup with pnpm workspaces
- Electron main process with secure defaults
- SolidJS renderer with Vite
- Preload bridge with contextBridge
- TypeScript strict mode configuration
- ESLint, Prettier, Husky tooling
- 6 packages: main, preload, renderer, server, ekacode, shared

**Out of Scope:**

- Hono server implementation (Phase 1)
- Mastra agent integration (Phase 2)
- File system watching (Phase 1)
- UI component library (Phase 2+)
- Testing infrastructure (Phase 3)

## Decisions

1. **electron-vite over electron-forge**: Better Vite integration, simpler config
2. **SolidJS over React**: Better performance, simpler reactivity model
3. **pnpm over npm/yarn**: Faster, more efficient disk usage
4. **Sandbox enabled**: Security best practice for Electron
5. **Separate preload package**: Clean separation of concerns

## Context

- This is the foundation for the ekacode AI coding agent
- Future phases will build on this structure
- Security defaults prevent Node API access in renderer
- Turborepo enables efficient monorepo development
