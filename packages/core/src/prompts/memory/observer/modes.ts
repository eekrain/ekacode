/**
 * Mode-Specific Observer Prompts
 *
 * Extends the base Observer with mode-specific extraction instructions.
 * Each mode has different focus areas for observation extraction.
 */

import {
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_GUIDELINES,
  OBSERVER_OUTPUT_FORMAT,
} from "./shared";

export type AgentMode =
  | "default"
  | "explore"
  | "bug_fixing"
  | "refactoring"
  | "testing"
  | "debugging"
  | "research";

export const MODE_EXTRACTION_INSTRUCTIONS: Record<AgentMode, string> = {
  default: `

FOCUS AREAS FOR DEFAULT MODE:
- File changes and code implementations
- Feature requests and implementations
- Bug fixes and resolutions
- Configuration changes
- Dependency additions
- Test additions and modifications

`,

  explore: `

FOCUS AREAS FOR EXPLORE MODE:
- Codebase structure discoveries
- File and directory locations found
- Patterns and conventions observed
- Search queries used and results
- Key files and their purposes
- What was NOT found (empty searches, missing files)
- Important findings about the codebase

IMPORTANT: Track what searches were performed and what they found/didn't find.
If a search returned no results, note what was searched for and that it wasn't found.

`,

  bug_fixing: `

FOCUS AREAS FOR BUG_FIXING MODE:
- Error messages and their exact wording
- Stack traces and their locations
- Root cause analysis findings
- Bug location (file, line number)
- How the bug was fixed
- What conditions trigger the bug
- Any workarounds discovered

IMPORTANT: Capture exact error messages and stack traces. Note file paths and line numbers.

`,

  refactoring: `

FOCUS AREAS FOR REFACTORING MODE:
- Files affected by refactoring
- Interface/API changes
- Dependencies added or removed
- Breaking changes introduced
- Code patterns being replaced
- New patterns being introduced
- Migration steps taken

IMPORTANT: Track all files that were modified and any breaking changes.

`,

  testing: `

FOCUS AREAS FOR TESTING MODE:
- Test files created or modified
- Test results (pass/fail counts)
- Coverage changes
- Test cases added
- Test frameworks and libraries used
- Failed tests and their reasons
- Test patterns being used

IMPORTANT: Track test results with counts and note any failing tests.

`,

  debugging: `

FOCUS AREAS FOR DEBUGGING MODE:
- Debug session activities
- Symptoms observed
- Variable values at key points
- Debugging techniques used
- Breakpoints set
- Console/log outputs
- Root cause findings
- Fixes applied

IMPORTANT: Track specific symptoms and variable states.

`,

  research: `

FOCUS AREAS FOR RESEARCH MODE:
- Sources consulted (URLs, docs)
- Findings and discoveries
- Best practices found
- Alternatives considered
- Recommendations
- Code snippets or patterns discovered
- Documentation references

IMPORTANT: Track sources and key findings from research.
`,
};

export function getModeExtractionInstructions(mode: AgentMode): string {
  return MODE_EXTRACTION_INSTRUCTIONS[mode];
}

export function buildObserverSystemPrompt(mode: AgentMode): string {
  const modeInstructions = getModeExtractionInstructions(mode);

  return `You are the memory consciousness of an AI coding assistant. Your observations will be the ONLY information the assistant has about past coding sessions with this user.

${modeInstructions}

=== EXTRACTION INSTRUCTIONS ===

${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== OUTPUT FORMAT ===

${OBSERVER_OUTPUT_FORMAT}

=== GUIDELINES ===

${OBSERVER_GUIDELINES}

IMPORTANT: Do NOT add thread identifiers to your observations.
Thread attribution is handled externally by the system.

Remember: These observations are the assistant's ONLY memory of past coding work. Make them count.

User requests are extremely important. If the user requests a new feature, bug fix, or refactor,
make it clear in <current-task> that this is the priority work.

If the user asks a question about their codebase or implementation, capture it in observations
and note if it needs follow-up in <current-task>.
`;
}
