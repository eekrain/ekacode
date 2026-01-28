# Phase 0 Standards Reference

## From agent-os/standards/global/tech-stack.md

### Desktop Framework

```yaml
electron:
  version: "latest stable"
  build_tool: "electron-vite"
  security:
    node_integration: false
    context_isolation: true
    sandbox: true
```

### UI Framework

```yaml
solidjs:
  version: "^1.x"
  build_tool: "vite"
  plugin: "@solidjs/vite-plugin"
```

### Monorepo

```yaml
turborepo:
  version: "^2.0.0"
  package_manager: "pnpm"
  workspace_config: "pnpm-workspace.yaml"
```

### Tooling

```yaml
typescript:
  version: "^5.6.0"
  strict_mode: true

eslint:
  version: "^9.0.0"
  typescript_eslint: "^8.0.0"

prettier:
  version: "^3.0.0"
  plugins:
    - "prettier-plugin-organize-imports"
    - "prettier-plugin-tailwindcss"

husky:
  version: "^9.0.0"
  lint_staged:
    version: "^15.0.0"
```

## Package Naming Conventions

- `@ekacode/main` - Electron main process
- `@ekacode/preload` - Preload script
- `@ekacode/renderer` - SolidJS UI
- `@ekacode/server` - Hono server
- `@ekacode/core` - Main agent package
- `@ekacode/shared` - Shared utilities
