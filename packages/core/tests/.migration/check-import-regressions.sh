#!/bin/bash

set -e

# Import Regression Check Script for Core Tests
#
# This script checks for common import regressions that could destabilize
# the core test architecture after migration.

echo "Running import regression checks for @sakti-code/core..."

FAILED=0

# Check 1: No deep relative source imports in unit tests
echo ""
echo "Check 1: Deep relative source imports in unit tests..."
DEEP_IMPORTS=$(grep -r "\.\./\.\./src\|\.\./\.\./\.\./src\|\.\./\.\./\.\./\.\./src" packages/core/src/**/__tests__/ 2>/dev/null || true)
if [ -n "$DEEP_IMPORTS" ]; then
  echo "❌ FAILED: Found deep relative source imports in unit tests:"
  echo "$DEEP_IMPORTS"
  FAILED=1
else
  echo "✓ PASSED: No deep relative source imports found"
fi

# Check 2: No banned cross-package imports in core
echo ""
echo "Check 2: Banned cross-package imports in core..."
BANNED_IMPORTS=$(grep -r "@sakti-code/server" packages/core/src/ packages/core/tests/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "vitest.setup.ts" | grep -v "core-db.ts" | grep -v ".migration/" || true)
if [ -n "$BANNED_IMPORTS" ]; then
  echo "❌ FAILED: Found banned cross-package imports (excluding setup/bridge files):"
  echo "$BANNED_IMPORTS"
  FAILED=1
else
  echo "✓ PASSED: No banned cross-package imports found"
fi

# Check 3: No reintroduced stale test directories
echo ""
echo "Check 3: Reintroduced stale test directories..."
STALE_DIRS=$(ls packages/core/tests/ 2>/dev/null | grep -E "^(chat|lsp|workspace|plugin)$" || true)
if [ -n "$STALE_DIRS" ]; then
  echo "❌ FAILED: Found reintroduced stale test directories:"
  echo "$STALE_DIRS"
  FAILED=1
else
  echo "✓ PASSED: No stale test directories reintroduced"
fi

# Check 4: Verify @/ alias is used in integration tests
echo ""
echo "Check 4: Deep relative imports in integration tests..."
INTEGRATION_DEEP=$(grep -r "\.\./\.\./src" packages/core/tests/integration/ 2>/dev/null || true)
if [ -n "$INTEGRATION_DEEP" ]; then
  echo "❌ FAILED: Found deep relative imports in integration tests (should use @/):"
  echo "$INTEGRATION_DEEP"
  FAILED=1
else
  echo "✓ PASSED: Integration tests use stable aliases"
fi

echo ""
if [ $FAILED -eq 0 ]; then
  echo "✅ All import regression checks passed!"
  exit 0
else
  echo "❌ Some import regression checks failed. Please fix the issues above."
  exit 1
fi
