# Requirements

## v0.1 Requirements

### Settings Dialog Structure

- [ ] **DIALOG-01**: Settings dialog component with two-column layout (sidebar + content)
- [ ] **DIALOG-02**: Sidebar navigation with all menu items (General, Account, Git, Terminal, MCP, Commands, Agents, Memory, Hooks, Providers, Experimental, Changelog, Docs)
- [ ] **DIALOG-03**: Active state styling for selected sidebar item
- [ ] **DIALOG-04**: External link icon for Changelog and Docs items

### General Settings Tab

- [ ] **GENERAL-01**: Default model selector (dropdown)
- [ ] **GENERAL-02**: Default thinking level selector (dropdown)
- [ ] **GENERAL-03**: Theme selector (dropdown: System/Light/Dark)
- [ ] **GENERAL-04**: Session notifications toggle
- [ ] **GENERAL-05**: Completion sound effects toggle
- [ ] **GENERAL-06**: Send messages with selector (Enter / Shift+Enter)
- [ ] **GENERAL-07**: "I'm not absolutely right" toggle
- [ ] **GENERAL-08**: Strict data privacy toggle

### UI Components

- [ ] **UI-01**: Select dropdown component with dark theme styling
- [ ] **UI-02**: Toggle switch component with dark theme styling
- [ ] **UI-03**: Settings row component (label + description + control)
- [ ] **UI-04**: Settings section header component

### Integration

- [ ] **INT-01**: Replace settings-view.tsx with dialog trigger in navigation
- [ ] **INT-02**: Dialog opens on settings menu click
- [ ] **INT-03**: Theme toggle updates application theme

---

## v0.2 Requirements (Future)

- Account settings tab content
- Git settings tab content
- Terminal settings tab content
- MCP settings tab content
- Commands settings tab content
- Agents settings tab content
- Memory settings tab content
- Hooks settings tab content
- Providers settings tab content
- Experimental settings tab content

---

## Out of Scope

- Backend settings persistence (localStorage only)
- Settings synchronization across devices
- Import/export settings
- Settings search/filter
- Reset to defaults functionality

---

## Traceability

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| DIALOG-01   | 1     | —      |
| DIALOG-02   | 1     | —      |
| DIALOG-03   | 1     | —      |
| DIALOG-04   | 1     | —      |
| GENERAL-01  | 1     | —      |
| GENERAL-02  | 1     | —      |
| GENERAL-03  | 1     | —      |
| GENERAL-04  | 1     | —      |
| GENERAL-05  | 1     | —      |
| GENERAL-06  | 1     | —      |
| GENERAL-07  | 1     | —      |
| GENERAL-08  | 1     | —      |
| UI-01       | 1     | —      |
| UI-02       | 1     | —      |
| UI-03       | 1     | —      |
| UI-04       | 1     | —      |
| INT-01      | 2     | —      |
| INT-02      | 2     | —      |
| INT-03      | 2     | —      |
