#!/usr/bin/env bash
set -euo pipefail

pnpm --filter @sakti-code/desktop test:run tests/unit/components/markdown.test.tsx
pnpm --filter @sakti-code/desktop test:run tests/unit/components/markdown-streaming.test.tsx
pnpm --filter @sakti-code/desktop test:run tests/integration/markdown-stream-stress.test.tsx
