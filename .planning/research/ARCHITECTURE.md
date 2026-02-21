# Architecture Patterns: Two-Column Settings Dialog in SolidJS

**Project:** Settings Dialog Component  
**Domain:** Component Architecture  
**Researched:** February 22, 2026  
**Confidence:** HIGH

## Executive Summary

This research establishes the recommended component architecture for building a two-column settings dialog in SolidJS using @kobalte/core dialog primitives and Tailwind CSS. The architecture follows a **compositional pattern** with clear component boundaries: dialog orchestration at the top level, tab navigation in the sidebar, and settings content in the main panel.

**Key architectural decisions:**

1. Use `@kobalte/core` Dialog primitive wrapped in a custom dialog component (existing pattern in codebase)
2. Use `@kobalte/core` Tabs for sidebar navigation
3. Follow the codebase's existing Card-based layout patterns
4. Use SolidJS `createSignal` for local dialog state and `createResource` for async data
5. Apply Tailwind CSS Grid for the two-column layout with responsive fallback

---

## Component Architecture Overview

### Recommended Component Hierarchy

```
SettingsDialog (orchestrator)
├── Dialog (from @kobalte/core, wrapped)
│   ├── Dialog.Overlay
│   └── Dialog.Content
│       └── DialogHeader (title, close button)
│       └── SettingsDialogLayout (two-column grid)
│           ├── SettingsSidebar (tabs navigation)
│           │   └── Tabs.List
│           │       └── Tabs.Trigger (multiple)
│           └── SettingsContent (main panel)
│               └── Tabs.Content (multiple)
│                   └── SettingsSection (repeated)
│                       └── SettingsRow (various controls)
```

### Component Boundaries

| Component              | Responsibility                                  | Data Flow                          | Communicates With          |
| ---------------------- | ----------------------------------------------- | ---------------------------------- | -------------------------- |
| `SettingsDialog`       | Orchestrates open/close state, dialog lifecycle | Props in, events out               | Parent via props           |
| `SettingsDialogLayout` | Grid layout, responsive behavior                | Children injection                 | Slots content              |
| `SettingsSidebar`      | Tab navigation state                            | Uses Kobalte Tabs                  | `SettingsContent` via Tabs |
| `SettingsContent`      | Renders active tab panel                        | Props + children                   | Children                   |
| `SettingsSection`      | Groups related settings                         | Props for title, description       | Content rows               |
| `SettingsRow`          | Individual setting with label + control         | Props: label, description, control | Parent form                |

---

## Data Flow Patterns

### State Management Strategy

**Local Component State:**

```typescript
// SettingsDialog.tsx
const [activeTab, setActiveTab] = createSignal("general");
const [isOpen, setIsOpen] = createSignal(false);

// Use createResource for async data
const [preferences] = createResource(() => client.getPreferences());
```

**Props Interface (SettingsDialog):**

```typescript
interface SettingsDialogProps {
  open: boolean; // Controlled by parent
  onOpenChange: (open: boolean) => void;
  client?: ProviderClient; // Optional data client
  children?: JSX.Element; // Custom settings content
}
```

**Props Interface (SettingsRow - flexible control types):**

```typescript
interface SettingsRowProps {
  label: string;
  description?: string;
  control: "toggle" | "input" | "select" | "custom";
  // Control-specific props
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  options?: Array<{ label: string; value: string }>;
  children?: JSX.Element; // For custom controls
}
```

### Data Flow Direction

```
Parent Component
       │
       │ props.open, props.onOpenChange
       ▼
SettingsDialog
       │
       │ createSignal/createResource (local state)
       │
       ▼
SettingsSidebar ──Kobalte Tabs state──► SettingsContent
       │                                        │
       │ Tabs.Trigger events                   │ Renders active
       ▼                                        ▼
  User Selection                         SettingsSection
                                             │
                                             ▼
                                       SettingsRow
                                             │
                                             ▼
                                       Form Control
```

---

## Dialog Primitive Pattern (@kobalte/core)

### Existing Pattern in Codebase

The codebase already wraps `@kobalte/core` Dialog primitives in a custom component:

**Current implementation** (`src/components/ui/dialog.tsx`):

```typescript
import * as DialogPrimitive from "@kobalte/core/dialog";

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = DialogPrimitive.Overlay;
const DialogContent = DialogPrimitive.Content;
```

### Recommended Extension for Settings Dialog

```typescript
// components/ui/settings-dialog.tsx
import { Dialog, DialogContent, DialogOverlay } from "./dialog";
import { splitProps } from "solid-js";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: JSX.Element;
}

export function SettingsDialog(props: SettingsDialogProps) {
  const [local, others] = splitProps(props, ["open", "onOpenChange", "title", "description", "children"]);

  return (
    <Dialog open={local.open} onOpenChange={local.onOpenChange}>
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <DialogContent class="...">
          {/* Two-column layout */}
          <div class="grid grid-cols-[240px_1fr] min-h-[500px]">
            {local.children}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
```

---

## Tabs Navigation Pattern (@kobalte/core)

### Anatomy

From `@kobalte/core/tabs`:

- `Tabs.Root` - Container for the tabs
- `Tabs.List` - Container for tab triggers
- `Tabs.Trigger` - Individual tab button
- `Tabs.Content` - Panel content for each tab
- `Tabs.Indicator` - Visual indicator (optional)

### Implementation Pattern

```typescript
import { Tabs } from "@kobalte/core/tabs";

interface SettingsTabsProps {
  children: JSX.Element;
}

export function SettingsSidebar(props: SettingsTabsProps) {
  return (
    <Tabs.List class="flex flex-col border-r border-border/80 bg-muted/30 p-2">
      {props.children}
    </Tabs.List>
  );
}

// Usage
<Tabs defaultValue="general">
  <SettingsSidebar>
    <Tabs.Trigger
      value="general"
      class="rounded-md px-3 py-2 text-left text-sm data-[selected]:bg-background data-[selected]:font-medium"
    >
      General
    </Tabs.Trigger>
    <Tabs.Trigger value="appearance" class="...">
      Appearance
    </Tabs.Trigger>
  </SettingsSidebar>
  <Tabs.Content value="general">...</Tabs.Content>
  <Tabs.Content value="appearance">...</Tabs.Content>
</Tabs>
```

### Important Note on Suspense

When using Kobalte Tabs with async data, wrap in `Show` or `Suspense` to avoid issues:

```typescript
<Show when={!loading()} fallback={<div>Loading...</div>}>
  <Tabs defaultValue="general">
    {/* tabs content */}
  </Tabs>
</Show>
```

---

## Tailwind CSS Two-Column Layout

### Recommended Grid Pattern

```typescript
// Two-column layout with fixed sidebar, fluid content
<div class="grid grid-cols-[240px_1fr] min-h-[500px]">
  {/* Sidebar - fixed width */}
  <aside class="border-r border-border/80 bg-muted/30 p-4">
    <Tabs.List>...</Tabs.List>
  </aside>

  {/* Content - fills remaining space */}
  <main class="overflow-y-auto p-6">
    <Tabs.Content>...</Tabs.Content>
  </main>
</div>
```

### Responsive Fallback

```typescript
// Mobile: stacked layout, Desktop: side-by-side
<div class="grid grid-cols-1 md:grid-cols-[240px_1fr]">
  <aside class={/* hide on mobile, show on desktop */ "hidden md:block border-r border-border/80 bg-muted/30 p-4"}>
    <Tabs.List>...</Tabs.List>
  </aside>
  <main class="p-4">
    {/* Content */}
  </main>
</div>
```

### Dark Theme Patterns (from existing codebase)

```typescript
// Sidebar styling (matches existing patterns)
class="border-border/80 bg-muted/30"

// Content area
class="bg-background/30"

// Scrollbar styling (existing pattern)
class="[&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50
      [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]
      [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
```

---

## Settings Row Patterns

### Standard Row Structure

```typescript
interface SettingsRowProps {
  label: string;
  description?: string;
  children: JSX.Element;  // Control component
}

// Component implementation
export function SettingsRow(props: SettingsRowProps) {
  return (
    <div class="flex items-start justify-between gap-4 py-4">
      <div class="flex-1">
        <p class="text-sm font-medium">{props.label}</p>
        <Show when={props.description}>
          <p class="text-muted-foreground mt-0.5 text-xs">{props.description}</p>
        </Show>
      </div>
      <div class="w-[200px]">
        {props.children}
      </div>
    </div>
  );
}
```

### Control Types

| Control Type | Component                     | Use Case                      |
| ------------ | ----------------------------- | ----------------------------- |
| Toggle       | `Switch` (@kobalte/core)      | Boolean on/off settings       |
| Text Input   | `TextField` (@kobalte/core)   | String values                 |
| Select       | `Select` (@kobalte/core)      | Single selection from options |
| Number       | `NumberField` (@kobalte/core) | Numeric values                |
| Custom       | Pass as `children`            | Complex controls              |

### Settings Section Grouping

```typescript
interface SettingsSectionProps {
  title: string;
  description?: string;
  children: JSX.Element;
}

export function SettingsSection(props: SettingsSectionProps) {
  return (
    <div class="mb-6">
      <div class="mb-4">
        <h3 class="text-sm font-semibold">{props.title}</h3>
        <Show when={props.description}>
          <p class="text-muted-foreground mt-1 text-xs">{props.description}</p>
        </Show>
      </div>
      <div class="divide-y divide-border/60">
        {props.children}
      </div>
    </div>
  );
}
```

---

## Build Order and Dependencies

### Component Creation Order

1. **Foundation Layer** (no dependencies)
   - `SettingsRow.tsx` - Basic building block
   - `SettingsSection.tsx` - Groups rows
2. **Navigation Layer** (depends on foundation)
   - `SettingsSidebar.tsx` - Tab navigation container
   - `SettingsContent.tsx` - Tab panel container

3. **Layout Layer** (depends on navigation)
   - `SettingsDialogLayout.tsx` - Grid layout wrapper
4. **Orchestration Layer** (depends on all)
   - `SettingsDialog.tsx` - Main dialog with state management

### File Structure Recommendation

```
src/
├── components/
│   └── ui/
│       ├── settings-dialog.tsx      # Orchestrator
│       ├── settings-dialog-layout.tsx # Two-column grid
│       ├── settings-sidebar.tsx      # Tab navigation
│       ├── settings-content.tsx      # Tab panels
│       ├── settings-section.tsx      # Section grouping
│       └── settings-row.tsx          # Individual setting
└── views/
    └── components/
        └── provider-settings.tsx     # Example usage (existing)
```

---

## Patterns to Follow

### Pattern 1: Props-Driven Composition

```typescript
// Good: Accept children for flexibility
interface SettingsDialogProps {
  children: JSX.Element;
}

// Good: Use specific props for known configurations
interface SettingsRowProps {
  label: string;
  control: "toggle" | "input" | "select";
  // ... type-safe control props
}
```

### Pattern 2: Controlled + Uncontrolled Support

```typescript
interface SettingsDialogProps {
  open?: boolean; // Controlled
  defaultOpen?: boolean; // Uncontrolled
  onOpenChange?: (open: boolean) => void;
}
```

### Pattern 3: Slot-Based Navigation

```typescript
// Use Kobalte's slot pattern
<Tabs defaultValue="general">
  <Tabs.List>
    <Tabs.Trigger value="general">General</Tabs.Trigger>
    <Tabs.Trigger value="appearance">Appearance</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="general">{/* content */}</Tabs.Content>
</Tabs>
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Inline State in Dialog Content

**Bad:**

```typescript
<DialogContent>
  <div>
    {createSignal("value")}  // Creates new signal on every render
  </div>
</DialogContent>
```

**Good:**

```typescript
// Define state in parent component
const [value, setValue] = createSignal("default");
<SettingsRow>{value()}</SettingsRow>
```

### Anti-Pattern 2: Deep Prop Drilling

**Bad:**

```typescript
<SettingsDialog>
  <SettingsContent>
    <SettingsSection>
      <SettingsRow
        onChange={(val) => props.onNestedChange(props.nestedId, val)}
      />
    </SettingsSection>
  </SettingsContent>
</SettingsDialog>
```

**Good:** Use SolidJS context for deep state:

```typescript
// contexts/settings-context.tsx
const SettingsContext = createContext<SettingsContextValue>();
```

### Anti-Pattern 3: Hardcoded Content in Dialog

**Bad:**

```typescript
<DialogContent>
  <div class="grid...">
    <div>General Settings...</div>
    <div>Appearance Settings...</div>
  </div>
</DialogContent>
```

**Good:** Use composition pattern:

```typescript
<SettingsDialog>
  <SettingsSidebar>{/* tabs */}</SettingsSidebar>
  <SettingsContent>{/* tab panels */}</SettingsContent>
</SettingsDialog>
```

---

## Scalability Considerations

### At Small Scale (< 10 settings)

- Single file component acceptable
- Simple `createSignal` for state
- Hardcoded tab content

### At Medium Scale (10-30 settings)

- Separate components per section
- Shared state via context
- Async data via `createResource`

### At Large Scale (30+ settings)

- Lazy-loaded tab content
- Form-level validation
- Persisted state with debouncing

---

## Sources

- Kobalte Core Dialog: https://kobalte.dev/docs/core/components/dialog/
- Kobalte Core Tabs: https://kobalte.dev/docs/core/components/tabs/
- SolidJS Props Documentation: https://docs.solidjs.com/concepts/components/props
- SolidJS Children: https://docs.solidjs.com/reference/component-apis/children
- Tailwind CSS Grid: https://tailwindcss.com/docs/grid-template-columns
- Existing Codebase Patterns: `provider-settings.tsx`, `dialog.tsx`

---

## Confidence Assessment

| Area                 | Confidence | Notes                                  |
| -------------------- | ---------- | -------------------------------------- |
| Kobalte integration  | HIGH       | Documented, verified in codebase       |
| Two-column layout    | HIGH       | Standard Tailwind CSS patterns         |
| SolidJS state        | HIGH       | Follows documented SolidJS patterns    |
| Component boundaries | MEDIUM     | Recommended based on existing patterns |
| Responsive patterns  | HIGH       | Standard Tailwind approaches           |

---

## Research Gaps

- **Async loading patterns**: Could benefit from phase-specific research on loading states
- **Form validation**: Not covered; would need additional research for complex forms
- **Accessibility testing**: Recommend manual testing with screen readers

---

## Recommendations for Roadmap

Based on this research, the recommended phase structure:

1. **Phase 1: Foundation Components** - Build `SettingsRow` and `SettingsSection`
2. **Phase 2: Navigation** - Implement `SettingsSidebar` with Kobalte Tabs
3. **Phase 3: Layout** - Create `SettingsDialogLayout` grid wrapper
4. **Phase 4: Orchestration** - Build `SettingsDialog` with state management
5. **Phase 5: Integration** - Wire into existing application

This ordering ensures each phase has working components that feed into the next.
