# Domain Pitfalls: Settings Dialog in SolidJS

**Domain:** Settings Dialog Component
**Framework:** SolidJS with Tailwind CSS
**Dialog Primitive:** @kobalte/core
**Researched:** February 2026
**Confidence:** MEDIUM

This document catalogs common mistakes and pitfalls encountered when building settings dialogs in SolidJS, particularly when using @kobalte/core for the dialog primitive and Tailwind CSS for styling. The findings are based on community experience, documentation analysis, and patterns observed in existing implementations.

---

## Critical Pitfalls

These are mistakes that cause rewrites, major bugs, or significant user experience issues.

### Pitfall 1: Prop Reactivity Destruction

**What goes wrong:** Destructuring props in SolidJS components breaks reactivity because props are proxies. When you destructure, you get the initial value, not a reactive reference.

**Why it happens:** SolidJS uses proxies for reactivity, and destructuring `const { value } = props` evaluates `props.value` once at render time, losing the reactive connection.

**Consequences:** Settings values stop updating when the underlying data changes. The UI becomes stale despite the data being modified elsewhere.

**Prevention:** Use `props.value` directly in JSX, or use `splitProps` utility to create a new reactive props object:

```typescript
// Bad - reactivity lost
function SettingsRow({ label, value, onChange }) {
  return <input value={value} onInput={onChange} />;
}

// Good - reactivity preserved
function SettingsRow(props) {
  return <input value={props.value} onInput={props.onChange} />;
}

// Alternative - splitProps preserves reactivity
function SettingsRow(props) {
  const [local, others] = splitProps(props, ["label", "value", "onChange"]);
  return <input value={local.value} onInput={local.onChange} />;
}
```

**Detection:** Add logging to verify signals are updating, or use SolidJS DevTools to inspect reactivity graph.

**Phase mapping:** This is a **Phase 1 (Foundation)** issue. Get reactivity correct from the start, or all subsequent work will be fragile.

---

### Pitfall 2: Improper Signal Access in JSX

**What goes wrong:** Passing signals directly to JSX props without calling them as functions, or calling signals too early in the component lifecycle.

**Why it happens:** React developers often pass signals as objects. In SolidJS, signals are functions that must be called: `value` not `value()` in JSX gives the function itself, not the value.

**Consequences:** Components render the function's string representation, or effects never trigger because dependencies are not properly tracked.

**Prevention:** Always call signals in JSX:

```typescript
// Bad - passes the signal function, not the value
<div>{someSignal}</div>

// Good - calls the signal to get the value
<div>{someSignal()}</div>

// Also good - using in attributes
<input value={someSignal()} />
```

**Phase mapping:** **Phase 1 (Foundation)** - This is a fundamental SolidJS pattern that must be correct from the start.

---

### Pitfall 3: Missing Dialog Focus Management

**What goes wrong:** The dialog opens but focus is not properly managed. Users can tab outside the dialog, or focus is lost entirely.

**Why it happens:** Not using @kobalte/core's built-in focus management, or overriding default behavior incorrectly.

**Consequences:** Accessibility violations, poor keyboard navigation, users losing their place in the dialog.

**Prevention:** Use @kobalte/core's Dialog components which handle focus trapping automatically:

```typescript
import { Dialog } from "@kobalte/core/dialog";

function SettingsDialog(props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
          {/* Content */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

For custom focus management, use `@kobalte/core`'s `focusScope` primitives.

**Phase mapping:** **Phase 2 (UI Construction)** - Once basic structure is in place, ensure accessibility is correct.

---

### Pitfall 4: Memory Leaks from Improper Cleanup

**What goes wrong:** Event listeners, timers, or subscriptions are not cleaned up when the dialog closes, causing memory to accumulate over time.

**Why it happens:** Forgetting to use `onCleanup` in effects, or not canceling pending operations when the dialog unmounts.

**Consequences:** Memory leaks, degraded performance over repeated dialog open/close cycles, potential errors from stale callbacks.

**Prevention:** Always clean up in effects:

```typescript
import { createEffect, onCleanup } from "solid-js";

function SettingsDialog(props) {
  createEffect(() => {
    if (props.isOpen) {
      // Setup
      const handler = e => console.log(e);
      window.addEventListener("keydown", handler);

      // Cleanup
      onCleanup(() => {
        window.removeEventListener("keydown", handler);
      });
    }
  });
}
```

Also cancel pending async operations:

```typescript
let abortController: AbortController | undefined;

createEffect(() => {
  if (props.isOpen) {
    abortController = new AbortController();
    fetchData(abortController.signal);
  } else {
    abortController?.abort();
    abortController = undefined;
  }
});
```

**Phase mapping:** **Phase 3 (Polish)** - These leaks are subtle and may only manifest after extensive use.

---

## Moderate Pitfalls

These mistakes cause delays, technical debt, or moderate user experience issues.

### Pitfall 5: Uncontrolled vs Controlled Dialog State Confusion

**What goes wrong:** Mixing controlled and uncontrolled dialog patterns, causing the dialog to behave inconsistently.

**Why it happens:** Not understanding the difference between `open` (controlled) and `defaultOpen` (uncontrolled) props in @kobalte/core.

**Consequences:** Dialog state becomes unpredictable, especially when external triggers try to open or close it.

**Prevention:** Choose one pattern and be consistent:

```typescript
// Controlled - parent manages state completely
function ControlledDialog(props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Content */}
    </Dialog>
  );
}

// Uncontrolled - dialog manages its own state
function UncontrolledDialog() {
  return (
    <Dialog defaultOpen={false}>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content>
          {/* Content */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

For settings dialogs that need to persist state or integrate with other components, prefer the controlled pattern.

**Phase mapping:** **Phase 2 (UI Construction)** - Decide early and implement consistently.

---

### Pitfall 6: Inefficient Derived State in Settings

**What goes wrong:** Computing derived values inside the component body without using `createMemo`, causing expensive recalculations on every render.

**Why it happens:** Not understanding SolidJS's fine-grained reactivity. Unlike React, you do need memos for derived values, but the pattern is different.

**Consequences:** Performance degradation, especially with many settings or complex computations.

**Prevention:** Use `createMemo` for derived values:

```typescript
import { createMemo } from "solid-js";

function SettingsPanel(props) {
  // Bad - computed on every render
  const displayValue = props.settings.theme + "-" + props.settings.fontSize;

  // Good - only recomputes when dependencies change
  const displayValue = createMemo(() => props.settings.theme + "-" + props.settings.fontSize);
}
```

However, avoid over-memoization. Simple derivations without side effects are often fine without memos in SolidJS due to its fine-grained reactivity.

**Phase mapping:** **Phase 3 (Performance)** - Optimize after profiling, not prematurely.

---

### Pitfall 7: Two-Column Layout Responsiveness Issues

**What goes wrong:** The two-column layout (sidebar + content) breaks on smaller screens or does not handle resize gracefully.

**Why it happens:** Not accounting for viewport changes, using fixed widths, or not testing mobile/tablet breakpoints.

**Consequences:** Content becomes inaccessible on certain devices, horizontal scrolling, or broken layouts.

**Prevention:** Use responsive Tailwind classes:

```typescript
<div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
  {/* Sidebar */}
  <nav class="w-full md:w-[240px]">
    <For each={settingsSections}>
      {(section) => (
        <button
          classList={{
            "w-full text-left px-3 py-2 rounded": true,
            "bg-primary text-primary-foreground": section.id === activeSection(),
            "hover:bg-muted": section.id !== activeSection(),
          }}
        >
          {section.label}
        </button>
      )}
    </For>
  </nav>

  {/* Content */}
  <div>{/* Settings content */}</div>
</div>
```

**Phase mapping:** **Phase 2 (UI Construction)** - Build responsively from the start, not as an afterthought.

---

### Pitfall 8: Missing Keyboard Navigation

**What goes wrong:** Settings dialog cannot be fully navigated with keyboard, violating accessibility requirements.

**Why it happens:** Not implementing keyboard handlers for custom interactions, or not using native form controls.

**Consequences:** Users relying on keyboards cannot access all settings, accessibility audits fail.

**Prevention:** Use native HTML form controls where possible, implement keyboard handlers for custom controls:

```typescript
function CustomSetting(props) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      increaseValue();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      decreaseValue();
    }
  };

  return (
    <div
      tabIndex={0}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={props.value}
      onKeyDown={handleKeyDown}
    >
      {/* Custom control */}
    </div>
  );
}
```

**Phase mapping:** **Phase 3 (Accessibility)** - Ensure all interactive elements are keyboard accessible.

---

### Pitfall 9: Not Handling Loading and Error States

**What goes wrong:** Settings dialog shows nothing or breaks when data is loading, or errors are silently ignored.

**Why it happens:** Not wrapping async operations in proper loading states, not handling error cases.

**Consequences:** Poor user experience, confusing states, potential crashes.

**Prevention:** Use SolidJS's `Show` and `Suspense` components:

```typescript
import { Show, Suspense } from "solid-js";

function SettingsDialog(props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Suspense fallback={<SettingsSkeleton />}>
            <Show when={!props.error} fallback={<ErrorDisplay error={props.error} />}>
              <SettingsForm />
            </Show>
          </Suspense>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

**Phase mapping:** **Phase 2 (UI Construction)** - Loading and error states are part of the basic UX.

---

### Pitfall 10: Dark Theme Color Inconsistencies

**What goes wrong:** Settings dialog has inconsistent colors in dark mode, or uses hardcoded colors that do not adapt to theme changes.

**Why it happens:** Not using CSS variables or Tailwind's dark mode utilities, or assuming a single theme.

**Consequences:** Poor visual experience in dark mode, jarring transitions when theme changes.

**Prevention:** Use Tailwind's color system and dark mode variants:

```typescript
// Good - uses Tailwind's color system
<div class="bg-background text-foreground border-border">
  <input class="bg-input border-input focus:border-primary" />
</div>

// For custom colors, use CSS variables
<div style={{ "--custom-bg": "var(--color-background)" }}>
```

Ensure your tailwind.config.js includes proper color mappings:

```javascript
// tailwind.config.js
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // etc.
      },
    },
  },
};
```

**Phase mapping:** **Phase 2 (UI Construction)** - Theme support should be built in from the start.

---

## Minor Pitfalls

These mistakes cause annoyance or minor issues that are relatively easy to fix.

### Pitfall 11: Excessive Re-renders from Effect Dependencies

**What goes wrong:** Effects run too frequently because dependencies are not properly specified.

**Why it happens:** Using objects or arrays as effect dependencies without understanding that new references trigger effects.

**Prevention:** Use primitives or createMemo for dependencies:

```typescript
// Bad - effect runs on every parent render
createEffect(() => {
  console.log(props.settings);
});

// Good - effect runs when specific properties change
createEffect(() => {
  console.log(props.settings.theme);
});

// Or track specific signals
createEffect(() => {
  const theme = props.themeSignal();
  console.log(theme);
});
```

**Phase mapping:** **Phase 3 (Performance)** - Optimize after identifying issues.

---

### Pitfall 12: Forgetting Portal Placement

**What goes wrong:** Dialog is clipped by parent containers with overflow: hidden or z-index contexts.

**Why it happens:** Not using Dialog.Portal to render the dialog at the document body level.

**Prevention:** Always wrap Dialog.Content in Dialog.Portal:

```typescript
<Dialog.Portal>
  <Dialog.Overlay />
  <Dialog.Content>
    {/* Dialog content */}
  </Dialog.Content>
</Dialog.Portal>
```

**Phase mapping:** **Phase 2 (UI Construction)** - This is fundamental to dialog behavior.

---

### Pitfall 13: Missing Dialog Titles and Descriptions

**What goes wrong:** Dialog lacks proper ARIA labels, making it inaccessible to screen readers.

**Why it happens:** Not including Dialog.Title and Dialog.Description components.

**Prevention:** Always include accessible labels:

```typescript
<Dialog.Content>
  <Dialog.Title>Settings</Dialog.Title>
  <Dialog.Description>
    Configure your application preferences here.
  </Dialog.Description>
  {/* Content */}
</Dialog.Content>
```

**Phase mapping:** **Phase 2 (UI Construction)** - This is an accessibility requirement.

---

### Pitfall 14: Not Using createStore for Complex Settings Objects

**What goes wrong:** Managing complex nested settings with separate signals becomes unwieldy.

**Why it happens:** Creating individual signals for each setting instead of using a store.

**Consequences:** Code duplication, difficulty in persisting or validating settings.

**Prevention:** Use SolidJS stores:

```typescript
import { createStore } from "solid-js/store";

function SettingsProvider(props) {
  const [settings, setSettings] = createStore({
    theme: "dark",
    fontSize: 14,
    notifications: {
      email: true,
      push: false,
    },
  });

  // Easy nested updates
  const updateTheme = (theme) => setSettings("theme", theme);
  const toggleEmail = () => setSettings("notifications", "email", (v) => !v);

  return (
    <props.children settings={settings} updateTheme={updateTheme} />
  );
}
```

**Phase mapping:** **Phase 1 (Foundation)** - Choose the right state management approach early.

---

## Phase-Specific Warnings

| Phase Topic     | Likely Pitfall              | Mitigation                                          |
| --------------- | --------------------------- | --------------------------------------------------- |
| Foundation      | Prop reactivity destruction | Use props directly or splitProps; never destructure |
| Foundation      | State management complexity | Use createStore for complex nested settings         |
| UI Construction | Focus management            | Use @kobalte/core's built-in focus trapping         |
| UI Construction | Portal placement            | Always wrap content in Dialog.Portal                |
| UI Construction | Accessibility labels        | Include Dialog.Title and Dialog.Description         |
| UI Construction | Responsive layout           | Test across breakpoints during construction         |
| Polish          | Memory leaks                | Use onCleanup for all subscriptions                 |
| Performance     | Inefficient derivations     | Profile before adding memos                         |
| Accessibility   | Keyboard navigation         | Test with keyboard only                             |

---

## Sources

- @kobalte/core Documentation: https://kobalte.dev/docs/core/components/dialog/
- SolidJS Best Practices: https://brenelz.com/posts/solid-js-best-practices/
- SolidJS Pain Points: https://vladislav-lipatov.medium.com/solidjs-pain-points-and-pitfalls-a693f62fcb4c
- SolidJS Documentation: https://docs.solidjs.com/
- WAI-ARIA Dialog Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/
