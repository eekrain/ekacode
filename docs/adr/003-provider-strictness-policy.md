# ADR 003: Provider Strictness Policy

## Status

Accepted

## Context

During the remediation work, we discovered that provider/context usage was inconsistent:

- Mixed import specifiers (`@renderer/*` vs relative paths)
- Global fallback stores masking real defects
- Hooks used outside providers without clear errors
- Ambiguous provider tree requirements

This led to runtime errors that were hard to debug and test failures that didn't reflect real usage patterns.

## Decision

We established a **strict provider architecture** with the following policies:

1. **No global fallbacks** - All store access must go through providers
2. **Fail-fast errors** - Clear messages when hooks are used outside providers
3. **Canonical import paths** - Use `@renderer/*` for all runtime-critical modules
4. **Explicit provider hierarchy** - Document and enforce provider nesting requirements

### Implementation Details

#### No Global Fallbacks

Removed the `globalThis.__ekacodeActiveStores__` escape hatch:

```typescript
// BEFORE: Had global fallback
export function useMessageStore() {
  const context = useContext(MessageContext);
  if (!context) {
    // Fallback to global - REMOVED
    return globalThis.__ekacodeActiveStores__?.message;
  }
  return context;
}

// AFTER: Strict context only
export function useMessageStore() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessageStore must be used within StoreProvider");
  }
  return context;
}
```

#### Fail-Fast Error Messages

Clear, actionable error messages:

```typescript
export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error(
      "useChatContext must be used within ChatProvider. " +
        "Ensure your component is wrapped in the ChatProvider component."
    );
  }
  return context;
}
```

#### Canonical Import Paths

Standardized on `@renderer/*` for all runtime-critical imports:

```typescript
// CORRECT
import { useMessageStore } from "@renderer/presentation/providers/store-provider";

// INCORRECT - Don't use relative paths for runtime-critical modules
import { useMessageStore } from "../providers/store-provider";
```

#### Provider Hierarchy

Documented the required provider nesting:

```tsx
// Required hierarchy
<StoreProvider>
  <MessageProvider>
    <PartProvider>
      <SessionProvider>
        <UIProvider>
          <ChatProvider>{/* Your components */}</ChatProvider>
        </UIProvider>
      </SessionProvider>
    </PartProvider>
  </MessageProvider>
</StoreProvider>
```

### Testing Strategy

Integration tests verify strict provider behavior:

```typescript
it("throws when useMessageStore called outside StoreProvider", () => {
  function ComponentUsingStore() {
    useMessageStore();
    return null;
  }

  expect(() => {
    render(() => <ComponentUsingStore />, container);
  }).toThrow("useMessageStore must be used within StoreProvider");
});
```

## Consequences

### Positive

- Immediate feedback for incorrect usage
- No hidden defects from global fallbacks
- Consistent import patterns across codebase
- Clear documentation of requirements
- Easier refactoring with explicit dependencies

### Negative

- More boilerplate for test setup (must wrap with providers)
- Stricter requirements for component composition
- Breaking change for any code relying on global fallback

### Neutral

- Requires discipline in import path selection
- Provider tree must be maintained consistently

## Migration Guide

### For Existing Code

1. Replace relative imports with `@renderer/*`:

   ```typescript
   // Find and replace
   import { X } from "../providers/Y";
   // With
   import { X } from "@renderer/presentation/providers/Y";
   ```

2. Ensure all components using stores are wrapped in providers

3. Add provider wrappers to tests:
   ```typescript
   render(() => (
     <TestProviders>
       <YourComponent />
     </TestProviders>
   ));
   ```

## Related Decisions

- ADR 001: Session Authority Model
- ADR 002: Stream Ingestion Source-of-Truth

## References

- `apps/desktop/src/presentation/providers/store-provider.tsx`
- `apps/desktop/src/presentation/providers/chat-provider.tsx`
- `apps/desktop/tests/integration/provider-initialization-order.test.tsx`
- `docs/desktop-streaming-rendering-remediation-plan.md` (WS1)
