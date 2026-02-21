# Research Summary: Settings Dialog Component

**Project:** OpenCode Settings Dialog  
**Synthesized:** February 2026  
**Confidence:** HIGH (based on existing codebase patterns + documented research)

---

## Executive Summary

This research synthesizes findings from parallel investigations into technology stack, features, architecture, and common pitfalls for building a two-column settings dialog in SolidJS using @kobalte/core and Tailwind CSS.

**Key Conclusions:**

1. **Use existing tools:** The codebase already has @kobalte/core and Tailwind CSS in use—leverage these rather than introducing new dependencies. The provider-settings.tsx pattern provides the exact template to follow.

2. **Follow compositional architecture:** Build from bottom up (SettingsRow → SettingsSection → SettingsSidebar → SettingsDialog) with clear component boundaries and props-driven composition.

3. **Avoid reactivity pitfalls:** SolidJS reactivity differs fundamentally from React—prop destructuring breaks reactivity, signals must be called as functions, and complex state should use createStore.

4. **Prioritize table stakes first:** Focus on two-column layout, sidebar navigation, toggles, selects, and immediate apply. Differentiators like search, tooltips, and reset-to-defaults come later.

---

## Key Findings

### From STACK.md

| Technology                 | Recommendation | Rationale                                                                                              |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| @kobalte/core              | Use existing   | Already in codebase; provides WAI-ARIA compliant dialog primitives with focus trapping, portal support |
| Tailwind CSS               | Use existing   | Already in codebase; provides utility classes for two-column layouts, dark theme                       |
| SolidJS signals            | Built-in       | createSignal/createMemo sufficient for local dialog state                                              |
| @solid-primitives/presence | Optional       | For dialog animations (already in project)                                                             |

**Critical pattern:** Follow provider-settings.tsx line 919 for two-column grid: `grid-cols-[sidebar_main]`

### From FEATURES.md

**Table Stakes (MVP - Must Have):**

- Two-column layout with sidebar navigation
- Toggle switches for boolean settings
- Select dropdowns for enumerated options
- Setting labels + descriptions
- Immediate apply (optimistic UI—no Save button)
- Close button + Escape key support

**Differentiators (Phase 2):**

- Search/filter within settings
- Collapsible sections
- Tooltips on hover
- "Requires restart" indicators
- Reset to defaults button

**Anti-Features (Avoid):**

- Save/Apply buttons (contradicts immediate apply)
- Modal within modal
- Hidden settings without disclosure
- Auto-saving without visual feedback

### From ARCHITECTURE.md

**Recommended Component Hierarchy:**

```
SettingsDialog (orchestrator)
├── Dialog (from @kobalte/core)
│   ├── Dialog.Overlay
│   └── Dialog.Content
│       └── SettingsDialogLayout (two-column grid)
│           ├── SettingsSidebar (tabs navigation)
│           │   └── Tabs.List + Tabs.Trigger
│           └── SettingsContent
│               └── SettingsSection (repeated)
│                   └── SettingsRow
```

**Build Order:**

1. Foundation Layer: SettingsRow, SettingsSection
2. Navigation Layer: SettingsSidebar, SettingsContent
3. Layout Layer: SettingsDialogLayout
4. Orchestration Layer: SettingsDialog

**Key Pattern:** Use controlled dialog pattern (open + onOpenChange props) for settings dialogs that integrate with other components.

### From PITFALLS.md

**Critical Pitfalls (Phase 1 - Must Prevent):**

| Pitfall                     | Prevention                                                          |
| --------------------------- | ------------------------------------------------------------------- |
| Prop reactivity destruction | Never destructure props; use `props.value` directly or `splitProps` |
| Improper signal access      | Always call signals: `value()`, not `value`                         |
| Missing focus management    | Use @kobalte/core Dialog which handles focus trapping               |
| Memory leaks                | Always use `onCleanup` for event listeners and subscriptions        |

**Moderate Pitfalls (Phase 2):**

- Controlled vs uncontrolled state confusion
- Inefficient derived state (use createMemo)
- Responsive layout issues
- Missing keyboard navigation
- Loading/error states missing
- Dark theme color inconsistencies

---

## Implications for Roadmap

### Recommended Phase Structure

**Phase 1: Foundation Components**

- Build SettingsRow and SettingsSection as atomic components
- Establish props interfaces for flexible control types
- **Deliverables:** Reusable row and section components
- **Pitfalls to avoid:** Prop reactivity destruction, signal access

**Phase 2: Navigation & Layout**

- Implement SettingsSidebar using @kobalte/core Tabs
- Create SettingsDialogLayout with two-column grid
- Add responsive fallback for mobile
- **Deliverables:** Working sidebar navigation with tabs
- **Pitfalls to avoid:** Portal placement, focus management, accessibility labels

**Phase 3: Dialog Orchestration**

- Build SettingsDialog wrapper with controlled state
- Integrate with existing codebase patterns
- Add loading and error states
- **Deliverables:** Functional settings dialog modal
- **Pitfalls to avoid:** Memory leaks, controlled/uncontrolled confusion

**Phase 4: Polish & Differentiators**

- Add search/filter functionality
- Implement collapsible sections
- Add tooltips and "requires restart" indicators
- Add reset to defaults
- **Deliverables:** Enhanced settings experience

### Research Flags

| Phase   | Needs Research | Standard Patterns                            |
| ------- | -------------- | -------------------------------------------- |
| Phase 1 | No             | SolidJS reactivity well-documented           |
| Phase 2 | No             | Kobalte Tabs + Tailwind Grid standard        |
| Phase 3 | No             | Dialog patterns well-established             |
| Phase 4 | Possibly       | User testing recommended for differentiators |

---

## Confidence Assessment

| Area         | Confidence | Notes                                              |
| ------------ | ---------- | -------------------------------------------------- |
| Stack        | HIGH       | Uses existing codebase technologies                |
| Features     | HIGH       | Based on established UI patterns + existing code   |
| Architecture | HIGH       | Follows documented SolidJS + Kobalte patterns      |
| Pitfalls     | MEDIUM     | Based on community experience; verify with testing |

---

## Gaps to Address

1. **User testing:** Validate which differentiators matter most for target users
2. **Accessibility audit:** Recommend manual testing with screen readers
3. **Settings persistence:** How settings are saved/loaded not covered
4. **Form validation:** Complex validation patterns not covered
5. **Async loading:** Could benefit from phase-specific research

---

## Sources

- **STACK.md:** Kobalte Dialog docs, SolidJS signals, Tailwind CSS layouts, existing codebase (provider-settings.tsx, model-selector.tsx)
- **FEATURES.md:** VS Code/Cursor patterns, Carbon Design System, NN/g guidelines
- **ARCHITECTURE.md:** Kobalte Tabs docs, SolidJS component patterns, existing codebase patterns
- **PITFALLS.md:** SolidJS community experience, WAI-ARIA dialog patterns
