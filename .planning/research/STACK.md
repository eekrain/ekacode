# Technology Stack: Settings Dialog Component

**Project:** Settings Dialog UI Component  
**Researched:** February 2026  
**Focus:** Two-column settings dialog in SolidJS with Tailwind CSS

## Executive Summary

This research covers the technology landscape for building a two-column settings dialog modal in SolidJS using Tailwind CSS. The recommended approach leverages @kobalte/core for accessible dialog primitives (already in use in the codebase), combined with Tailwind CSS for styling, following patterns already established in the codebase (provider-settings.tsx, model-selector.tsx).

---

## Recommended Stack

### Core Technologies

| Technology      | Version  | Purpose          | Why                                                                                                                              |
| --------------- | -------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| @kobalte/core   | Latest   | Dialog primitive | Already in use; provides WAI-ARIA compliant accessible dialog with controlled/uncontrolled state, focus trapping, portal support |
| Tailwind CSS    | v3.x+    | Styling          | Already in use; provides utility classes for two-column layouts, dark theme support                                              |
| SolidJS signals | Built-in | State management | Already in use; createSignal/createMemo for local dialog state                                                                   |

### UI Component Patterns

Based on existing codebase patterns (provider-settings.tsx):

| Pattern            | Implementation                                          | Source                               |
| ------------------ | ------------------------------------------------------- | ------------------------------------ |
| Dialog structure   | Kobalte Dialog.Portal + Dialog.Overlay + Dialog.Content | @kobalte/core                        |
| Two-column layout  | CSS Grid with `grid-cols-[sidebar_main]`                | provider-settings.tsx line 919       |
| Sidebar navigation | Vertical nav with active state styling                  | provider-settings.tsx lines 920-1002 |
| Toggle switches    | Native checkbox with custom styling                     | provider-settings.tsx lines 774-783  |
| Select dropdowns   | Native select with Tailwind styling                     | model-selector.tsx                   |
| Dialog animations  | @solid-primitives/presence                              | provider-settings.tsx line 615       |

---

## Alternative Options Considered

### Dialog Primitives

| Option                 | Status          | Why Not                                                            |
| ---------------------- | --------------- | ------------------------------------------------------------------ |
| @corvu/dialog          | Available       | Additional dependency; Kobalte already in use                      |
| solid-a11y-dialog      | Available       | Less maintained; fewer features than Kobalte                       |
| Native HTML `<dialog>` | Available       | Less accessible out-of-box; requires more work for complex dialogs |
| Custom implementation  | Not recommended | Reinventing accessibility patterns                                 |

**Recommendation:** Use @kobalte/core (already in project)

### State Management

| Option                    | When to Use                    | Why                                         |
| ------------------------- | ------------------------------ | ------------------------------------------- |
| createSignal + createMemo | Simple local state             | Already in use; sufficient for dialog state |
| createStore               | Complex nested state           | Overkill for typical settings dialog        |
| Context                   | Multiple dialogs sharing state | Only if dialog is used in many places       |

---

## Tailwind CSS Patterns for Dialogs

### Dialog Container Structure

```tsx
// Fixed overlay backdrop
<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
  {/* Backdrop */}
  <button
    class="absolute inset-0 bg-black/80 backdrop-blur-sm"
    onClick={closeModal}
    aria-label="Close"
  />

  {/* Dialog Content */}
  <div class="border-border bg-popover relative z-10 w-full max-w-4xl overflow-hidden rounded-xl border shadow-[0_28px_80px_rgba(0,0,0,0.6)]">
    {/* Content */}
  </div>
</div>
```

### Two-Column Layout Pattern

```tsx
<div class="grid h-[560px] min-h-0 gap-0 md:grid-cols-[1fr_1.4fr]">
  {/* Sidebar */}
  <div class="border-border min-h-0 overflow-y-auto border-r">{/* Navigation items */}</div>

  {/* Main Content */}
  <div class="min-h-0 overflow-y-auto">{/* Settings panels */}</div>
</div>
```

### Dark Theme Styling

```tsx
// From existing codebase patterns
class={cn(
  "border-border bg-popover text-popover-foreground",
  "hover:bg-muted/70 transition-colors"
)}
```

### Key Tailwind Classes

| Pattern         | Classes                                                   | Purpose             |
| --------------- | --------------------------------------------------------- | ------------------- |
| Dialog backdrop | `fixed inset-0 bg-black/80 backdrop-blur-sm`              | Full-screen overlay |
| Dialog content  | `relative z-10 w-full max-w-* rounded-xl border shadow-*` | Modal card          |
| Two-column grid | `grid md:grid-cols-[sidebar_main]`                        | Responsive columns  |
| Sidebar         | `border-r border-border min-h-0 overflow-y-auto`          | Scrollable sidebar  |
| Scrollbar       | `[scrollbar-width:thin] [&::-webkit-scrollbar]:w-2`       | Custom scrollbar    |
| Active nav item | `border-primary/45 bg-accent/70 shadow-*`                 | Selected state      |

---

## SolidJS Patterns for Dialog State Management

### Controlled Dialog Pattern (Recommended)

```tsx
import { Dialog } from "@kobalte/core/dialog";
import { createSignal } from "solid-js";

function SettingsDialog() {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Settings</Button>

      <Dialog open={open()} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 bg-black/80" />
          <Dialog.Content class="fixed inset-0 flex items-center justify-center p-4">
            {/* Dialog content */}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
```

### Settings Tab State Management

```tsx
import { createSignal, createMemo, For } from "solid-js";

type SettingsTab = "general" | "appearance" | "notifications" | "advanced";

function SettingsDialog() {
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("general");

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: "general", label: "General", icon: "..." },
    { id: "appearance", label: "Appearance", icon: "..." },
    { id: "notifications", label: "Notifications", icon: "..." },
    { id: "advanced", label: "Advanced", icon: "..." },
  ];

  return (
    <div class="grid md:grid-cols-[200px_1fr]">
      {/* Sidebar */}
      <nav class="border-border border-r">
        <For each={tabs}>
          {tab => (
            <button
              class={activeTab() === tab.id ? "bg-accent border-primary" : "hover:bg-muted"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          )}
        </For>
      </nav>

      {/* Content */}
      <div>
        <Switch>
          <Match when={activeTab() === "general"}>{/* General settings panel */}</Match>
          <Match when={activeTab() === "appearance"}>{/* Appearance settings panel */}</Match>
        </Switch>
      </div>
    </div>
  );
}
```

### Animation with @solid-primitives/presence

```tsx
import { createPresence } from "@solid-primitives/presence";

function AnimatedDialog(props: { open: boolean }) {
  const presence = createPresence(props.open, {
    transitionDuration: 220,
    initialEnter: true,
  });

  return (
    <Show when={presence.isMounted()}>
      <div
        data-visible={presence.isVisible() ? "" : undefined}
        data-exiting={presence.isExiting() ? "" : undefined}
      >
        {/* Content */}
      </div>
    </Show>
  );
}
```

---

## UI Control Patterns

### Toggle Switch

```tsx
<label class="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={settings().enabled}
    onChange={event => updateSettings({ enabled: event.currentTarget.checked })}
    class="border-border text-primary h-4 w-4 rounded"
  />
  <span>Enable feature</span>
</label>
```

### Select Dropdown

```tsx
<select
  class="bg-background border-border rounded border px-2 py-1 text-sm"
  value={settings().theme}
  onInput={event => updateSettings({ theme: event.currentTarget.value })}
>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
  <option value="system">System</option>
</select>
```

---

## Installation

```bash
# Core dependency (already in project)
npm install @kobalte/core

# For animations (optional, already in project)
npm install @solid-primitives/presence
```

---

## Sources

- **Kobalte Dialog:** https://kobalte.dev/docs/core/components/dialog/ (HIGH - Official documentation)
- **SolidJS Signals:** https://docs.solidjs.com/guides/state-management (HIGH - Official documentation)
- **Tailwind Layouts:** https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/multi-column (HIGH - Official Tailwind UI)
- **Provider Settings Pattern:** `apps/desktop/src/views/components/provider-settings.tsx` (HIGH - Existing codebase)
- **Model Selector Pattern:** `apps/desktop/src/views/components/model-selector.tsx` (HIGH - Existing codebase)
- **Ark UI Dialog (alternative):** https://ark-ui.com/docs/components/dialog (MEDIUM - Reference for patterns)
- **Web Dev Dialog:** https://web.dev/articles/building/a-dialog-component (MEDIUM - Modern dialog best practices)
