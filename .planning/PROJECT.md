# Project: Settings Dialog Migration

## What This Is

Convert the existing settings page (`apps/desktop/src/views/settings-view.tsx`) into a dialog/modal component with a two-column layout, matching the dark-themed aesthetic of the model selector and provider settings modal.

## Why It Matters

- Better UX: Settings accessible without leaving current context
- Consistent UI: Matches existing modal patterns in the app
- Modern feel: Two-column navigation + content layout

## Core Value

A settings dialog that allows users to configure app preferences without navigating away from their current work.

## Constraints

- Use existing `@/components/ui/dialog.tsx` as the base
- Match aesthetic of `model-selector.tsx` and `provider-settings.tsx`
- Dark theme with specific color palette (deep dark gray/black backgrounds)
- Two-column layout: sidebar navigation + main content area

## Current Milestone: v0.1 Settings Dialog

**Goal:** Convert settings page to dialog modal

**Target features:**

- Two-column settings dialog/modal
- Left sidebar with navigation items (General, Account, Git, Terminal, MCP, Commands, Agents, Memory, Hooks, Providers, Experimental, Changelog, Docs)
- Right content area with settings rows (labels, descriptions, controls)
- UI controls: Select dropdowns, Toggle switches
- Match dark theme aesthetic from reference components

### Validated

(None yet — this is the initial build)

### Active

- [ ] Settings dialog component with two-column layout
- [ ] Sidebar navigation with all menu items
- [ ] General settings tab content
- [ ] UI components: Select dropdown, Toggle switch
- [ ] Remaining tabs (Account, Git, Terminal, MCP, Commands, Agents, Memory, Hooks, Providers, Experimental, Changelog, Docs)

### Out of Scope

- [Any tabs not listed above] — Can be added later
- [Backend persistence] — Settings stored locally only for now
- [Settings synchronization] — Future feature

## Key Decisions

| Decision                       | Rationale                               | Outcome   |
| ------------------------------ | --------------------------------------- | --------- |
| Use existing Dialog component  | Leverage @kobalte/core/dialog primitive | — Pending |
| Match model-selector aesthetic | Consistent UI across app                | — Pending |
| Two-column layout              | Familiar settings pattern, scalable     | — Pending |

---

_Last updated: 2026-02-22 after initialization_
