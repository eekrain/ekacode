# Feature Landscape: Settings Dialog Component

**Domain:** Desktop Application Settings UI Component  
**Project:** OpenCode Settings Dialog  
**Researched:** February 2026  
**Confidence:** HIGH (based on existing codebase patterns + web research)

---

## Executive Summary

This research identifies the feature landscape for a modern two-column settings dialog component. Based on analysis of established UI patterns (VS Code, Cursor, Carbon Design System), existing codebase patterns (provider-settings.tsx), and current UX best practices, this document categorizes features into table stakes, differentiators, and anti-features.

**Key Finding:** The settings dialog should prioritize immediate feedback, clear navigation hierarchy, and consistent control patterns. Features should be organized to minimize cognitive load while providing quick access to frequently-changed settings.

---

## Table Stakes

Features users expect in any settings dialog. Missing these = product feels incomplete or broken.

### Navigation & Layout

| Feature                        | Why Expected                                                                     | Complexity | Implementation Notes                                           |
| ------------------------------ | -------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| Two-column layout with sidebar | Standard pattern across IDEs (VS Code, Cursor); enables quick category switching | Low        | Use CSS Grid with fixed sidebar width, scrollable content area |
| Sidebar navigation with icons  | Visual category identification; reduces reading load                             | Low        | Use consistent icon set (existing codebase icons)              |
| Active state indication        | Clear feedback on current location                                               | Low        | Border highlight + background color change (existing pattern)  |
| Keyboard navigation (Tab)      | Accessibility requirement; power user expectation                                | Medium     | Ensure focus management on open/close                          |
| Close button                   | Standard dialog pattern; escape key support                                      | Low        | Existing Kobalte Dialog handles this                           |
| Scrollable content areas       | Settings lists often exceed viewport                                             | Low        | Use overflow-y-auto with custom scrollbar styling              |

### Control Components

| Feature                                 | Why Expected                                              | Complexity | Implementation Notes                              |
| --------------------------------------- | --------------------------------------------------------- | ---------- | ------------------------------------------------- |
| Toggle switches for boolean settings    | Universal pattern for on/off settings; clear visual state | Low        | Custom styled checkbox following existing pattern |
| Select dropdowns for enumerated options | Standard for choosing from finite options                 | Low        | Native select with Tailwind styling               |
| Setting labels                          | Identify what each setting controls                       | Low        | Bold text, positioned left of control             |
| Setting descriptions                    | Explain what setting does; reduce support burden          | Low        | Secondary text below label; muted color           |

### Interaction Patterns

| Feature                         | Why Expected                                           | Complexity | Implementation Notes                                 |
| ------------------------------- | ------------------------------------------------------ | ---------- | ---------------------------------------------------- |
| Immediate apply (optimistic UI) | Users expect instant feedback; no "Save" button needed | Low        | Update state immediately, no explicit save action    |
| Default values visible          | Users should know what "normal" looks like             | Low        | Show current value, indicate if changed from default |
| Consistent spacing              | Reduces visual clutter; easier to scan                 | Low        | Use consistent gap/padding (existing spacing tokens) |

---

## Differentiators

Features that set a settings dialog apart. Not expected, but valued when present.

### Enhanced Navigation

| Feature                           | Value Proposition                                    | Complexity | Implementation Notes                                             |
| --------------------------------- | ---------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| Search/filter within settings     | Quick access to specific settings without scrolling  | Medium     | Add search input at top of content area; filter visible settings |
| Breadcrumb or "back" navigation   | Context preservation when drilling into sub-settings | Medium     | Show current location path; allow returning without losing state |
| Keyboard shortcuts for navigation | Power user efficiency; IDE-like experience           | Medium     | Allow jumping directly to settings via shortcuts                 |
| Recently changed section          | Quick access to just-modified settings               | Low        | Track last 3-5 changed settings; show at top                     |

### Advanced Controls

| Feature                               | Value Proposition                                         | Complexity | Implementation Notes                              |
| ------------------------------------- | --------------------------------------------------------- | ---------- | ------------------------------------------------- |
| Slider controls for numeric ranges    | Better UX than text input for values like volume, timeout | Medium     | Use `<input type="range">` with value display     |
| Color picker for color settings       | Visual feedback when selecting colors                     | Medium     | Native `<input type="color">` or custom component |
| Number input with increment/decrement | Precise control for numeric values                        | Low        | Combine number input with +/- buttons             |
| Multi-select for arrays               | Select multiple options from a list                       | Medium     | Checkboxes or tag-based selection                 |
| Text area for long-form settings      | Code snippets, custom prompts                             | Low        | Multiline textarea with monospace font            |

### Information & Feedback

| Feature                       | Value Proposition                        | Complexity | Implementation Notes                                        |
| ----------------------------- | ---------------------------------------- | ---------- | ----------------------------------------------------------- |
| Tooltips on hover             | Additional context without cluttering UI | Medium     | Show on icon hover; include keyboard shortcut hints         |
| "Requires restart" indicators | Clear communication when restart needed  | Low        | Badge or text indicating setting takes effect after restart |
| Unsaved changes warning       | Prevent accidental data loss             | Medium     | Track dirty state; prompt before closing                    |
| Setting change history        | Undo accidental changes                  | High       | Store previous values; allow reverting                      |
| Reset to defaults button      | Quick way to restore sane state          | Low        | Per-section or global reset option                          |

### Organization & Discovery

| Feature                         | Value Proposition                           | Complexity | Implementation Notes                            |
| ------------------------------- | ------------------------------------------- | ---------- | ----------------------------------------------- |
| Group headers with descriptions | Logical organization; easier scanning       | Low        | Section titles with optional description        |
| Collapsible sections            | Reduce clutter; show only relevant areas    | Low        | Accordion pattern for setting groups            |
| "What's new" or changelog entry | Feature discovery; context for new settings | Low        | Link to changelog from new/updated settings     |
| Recommended settings            | Guide new users; reduce decision fatigue    | Low        | Highlight suggested values for common use cases |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

### Anti-Patterns to Avoid

| Anti-Feature                                     | Why Avoid                                                  | What to Do Instead                                 |
| ------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| "Save" / "Apply" button                          | Creates unnecessary click; modern apps use immediate apply | Update settings immediately; provide undo instead  |
| Modal within modal (stacked dialogs)             | Confusing navigation; focus management issues              | Use inline expansion or side panel                 |
| Settings that require restart without indication | Users don't know why changes don't take effect             | Clearly indicate "Requires restart" with badge     |
| Inconsistent control types for same data type    | Cognitive load; users unsure how to interact               | Pick one control type per data type; be consistent |
| Hidden/advanced settings without disclosure      | Cluttered UI for beginners; hard to find for experts       | Use collapsible "Advanced" section                 |
| Settings that break the app without warning      | Poor UX; frustration                                       | Validate inputs; show inline errors                |
| Auto-saving without feedback                     | Users unsure if changes persisted                          | Provide subtle visual feedback (brief highlight)   |
| Duplicate settings in multiple places            | Confusion about which one takes precedence                 | Single source of truth; link to related settings   |

### Content Anti-Patterns

| Anti-Feature                           | Why Avoid                    | What to Do Instead                             |
| -------------------------------------- | ---------------------------- | ---------------------------------------------- |
| Jargon-heavy descriptions              | Excludes non-technical users | Use plain language; provide "learn more" links |
| Missing units on numeric values        | Users guess at meaning       | Always show units (ms, px, KB, etc.)           |
| Toggle labels that aren't action verbs | Ambiguous meaning            | Use "Enable X" / "Disable X" format            |
| Negative toggle labels                 | Double negative confusion    | Use positive labels: "Show X" not "Hide X"     |

---

## MVP Recommendation

For the initial settings dialog implementation, prioritize in this order:

### Phase 1: Table Stakes (Must Have)

1. **Two-column layout** - Sidebar + content area following existing provider-settings.tsx pattern
2. **Sidebar navigation** - With icons for: General, Account, Git, Terminal, MCP, Commands, Agents, Memory, Hooks, Providers, Experimental, Changelog, Docs
3. **Toggle switches** - For boolean settings using existing checkbox styling pattern
4. **Select dropdowns** - For enumerated settings using native select with Tailwind
5. **Setting labels + descriptions** - Clear identification and explanation
6. **Immediate apply** - Optimistic UI updates
7. **Close button + Escape key** - Standard dialog behavior via Kobalte

### Phase 2: Differentiators (Valued Additions)

1. **Search/filter** - Quick settings access (if settings list grows large)
2. **Collapsible sections** - Reduce clutter in complex categories
3. **Tooltips** - Additional context on hover
4. **"Requires restart" indicators** - For settings needing app restart
5. **Reset to defaults** - Per-section reset capability

### Post-MVP (Future Consideration)

- Setting change history with undo
- Keyboard shortcuts for navigation
- Unsaved changes warning
- Advanced settings disclosure pattern

---

## Feature Dependencies

```
Settings Dialog
├── Dialog Container (Kobalte)
│   ├── Close/Overlay Click → close dialog
│   └── Escape key → close dialog
├── Two-Column Layout
│   ├── Sidebar Navigation
│   │   ├── Category Icons
│   │   ├── Active State
│   │   └── Scrollable (if many categories)
│   └── Content Area
│       ├── Settings Rows
│       │   ├── Label + Description
│       │   ├── Control (toggle/select)
│       │   └── Optional: tooltip
│       └── Scrollable content
└── State Management
    ├── Current active tab
    ├── Settings values
    └── Dirty state (optional)
```

---

## Sources

### Primary Sources (High Confidence)

- **Existing Codebase:** `provider-settings.tsx` - Two-column layout, sidebar navigation, toggle patterns
- **Kobalte Dialog:** https://kobalte.dev/docs/core/components/dialog/ - Dialog primitive
- **Tailwind CSS Layouts:** https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/multi-column

### Secondary Sources (Medium Confidence)

- **Carbon Design System Dialog:** https://carbondesignsystem.com/patterns/dialog-pattern - Enterprise dialog patterns
- **Salt Design System Preferences Dialog:** https://saltdesignsystem.com/salt/patterns/preferences-dialog - Responsive dialog guidelines
- **NN/g Toggle Switch Guidelines:** https://www.nngroup.com/articles/toggle-switch-guidelines/ - Toggle UX best practices
- **SetProduct Settings UI:** https://www.setproduct.com/blog/settings-ui-design - Settings design patterns
- **Android Settings Guidelines:** https://developer.android.com/design/ui/mobile/guides/patterns/settings - Mobile settings patterns
- **Cursor Settings Documentation:** https://docs.cursor.com/settings/preferences - IDE settings organization
- **Web.dev Dialog Patterns:** https://web.dev/patterns/components/dialog - Modern dialog patterns

### Tertiary Sources (Reference)

- **LogRocket Settings Screen UX:** https://blog.logrocket.com/ux-design/designing-settings-screen-ui
- **Soulmatcher Dialog Best Practices:** https://soulmatcher.app/blog/dialog-window-design-best-practices-tips-examples/
- **Interaction Design Foundation:** https://www.interaction-design.org/literature/article/ui-form-design

---

## Confidence Assessment

| Area               | Confidence | Notes                                             |
| ------------------ | ---------- | ------------------------------------------------- |
| Table Stakes       | HIGH       | Based on established patterns + existing codebase |
| Differentiators    | HIGH       | Research-backed but may need user validation      |
| Anti-Features      | HIGH       | Industry consensus well-documented                |
| MVP Recommendation | HIGH       | Aligned with existing codebase patterns           |

---

## Gaps to Address

- **User testing:** Validate which differentiators matter most for target users
- **Settings complexity:** If settings list grows beyond ~20 per category, search becomes critical
- **Accessibility audit:** Verify keyboard navigation meets WCAG requirements
- **Persistence layer:** How settings are saved/loaded not covered in this research
