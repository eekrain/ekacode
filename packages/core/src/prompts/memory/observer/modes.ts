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

export const EXPLORER_TASK_CONTEXT = `
You are exploring the codebase to find information for the parent agent.

YOUR SPECIFIC OBJECTIVE:
\${explorationGoal}

Focus your memory on details relevant to this objective. The parent agent needs:
- Exact file paths where relevant code exists
- Interface/type definitions
- Schema definitions
- Function signatures
- "NOT FOUND" results (important to know what's missing)

When creating observations, prioritize accuracy over brevity. The parent will make decisions based on what you remember.
`;

export const EXPLORER_OUTPUT_FORMAT = `
Use this structured format to capture exploration findings:

<findings>
## Query: [what parent wanted]
- FOUND: [exact file path]:[line numbers] - [brief description]
- FOUND: [exact file path]:[line numbers] - [brief description]
- NOT FOUND: [what wasn't found]

## Query: [next thing parent wanted]
...
</findings>

<file_inventory>
[filepath1]: [key exports, interfaces, functions found]
[filepath2]: [key exports, interfaces, functions found]
</file_inventory>

<gaps>
- [Things that exist but weren't fully explored]
- [Things that definitely don't exist]
</gaps>

<current-task>
Primary: [what you're currently searching for]
Status: [in_progress / completed / not_found]
</current-task>
`;

export const EXPLORER_GUIDELINES = `
PRECISION OVER BREVITY - This is not build mode.

PRIORITY:
1. Exact file paths and line numbers
2. Complete interface/type definitions
3. "NOT FOUND" results (as important as found results)
4. Search queries used

WHAT TO CAPTURE:
- Full interface definitions (not summarized)
- Exact function signatures
- Schema structures
- Import paths
- Line numbers for key definitions

WHEN SOMETHING IS NOT FOUND:
- State explicitly: "NOT FOUND: LoginForm schema"
- This is critical info for parent agent

WHEN FOUND:
- Include file path: "src/auth/LoginForm.tsx"
- Include line number: "line 15-22"
- Include full definition if small, or key parts if large

DO NOT:
- Summarize code into natural language
- Skip details to save space
- Assume parent knows the codebase
`;

export const EXPLORER_COMPRESSION_GUIDANCE: Record<number, string> = {
  0: "",

  1: `
MILD CONSOLIDATION

Keep ALL findings. Only combine:
- Duplicate file references
- Same search query results

NEVER remove:
- "NOT FOUND" results
- Specific file paths
- Line numbers
- Interface definitions
`,

  2: `
MODERATE CONSOLIDATION

Keep ALL unique findings. Only remove:
- Exact duplicates of file+line combinations

Keep:
- Every unique file path
- Every "NOT FOUND" result
- Line numbers
- Interface/type definitions
`,
};

export const EXPLORER_CONTEXT_INSTRUCTIONS = `
Use these exploration findings to answer the parent's question.

For each finding:
- Cite the exact file path and line number
- Include the actual interface/type definition if relevant
- Note if something was "NOT FOUND"

The parent agent is making decisions based on what you found. Be precise.
`;

// ============================================================================
// BUG FIXING MODE PROMPTS
// ============================================================================

export const BUGFIXING_TASK_CONTEXT = `
You are investigating and fixing a bug. Your memory will help track the investigation.

YOUR OBJECTIVE:
\${bugDescription}

Focus on:
- Error messages and stack traces
- Root cause analysis
- What was attempted and what worked
- Files modified during fix
`;

export const BUGFIXING_EXTRACTION_INSTRUCTIONS = `
CRITICAL: Capture bug investigation details precisely.

For each message exchange, extract:

1. ERROR DETAILS - Exact error message, stack trace, line numbers
2. ROOT CAUSE - What was identified as the cause
3. ATTEMPTED FIXES - What was tried and the result
4. FILES INVOLVED - Files examined, modified
5. SOLUTION - What finally worked (if found)

PRESERVE EXACT DETAILS:
- Error messages: "TypeError: Cannot read property 'id' of undefined"
- Stack traces: Full trace with file:line
- Root cause: "Missing null check on user object at line 45"
`;

export const BUGFIXING_OUTPUT_FORMAT = `
<error_investigation>
## Initial Error
- Error type: [TypeError, ReferenceError, etc.]
- Error message: [exact message]
- Location: [file:line number]
- Stack trace: [key frames]

## Root Cause Analysis
- Suspected cause: [what you think caused it]
- Evidence: [files/lines supporting this]

## Attempted Fixes
- Attempt 1: [what was tried] → [success/failure]
- Attempt 2: [what was tried] → [success/failure]

## Final Solution
- Fix applied: [what worked]
- Files modified: [list]
</error_investigation>

<current-status>
Status: [investigating / fixing / resolved]
Remaining: [any outstanding issues]
</current-status>
`;

export const BUGFIXING_GUIDELINES = `
PRIORITY:
1. Exact error messages and stack traces
2. Root cause identification
3. What was attempted and results
4. Files modified

WHAT TO CAPTURE:
- Full error message text
- Complete stack traces with file:line
- Root cause analysis details
- Failed attempts (important for avoiding repeats)
- Successful fix and how it was applied

DO NOT:
- Summarize errors away
- Skip failed attempts
- Lose file:line references
`;

export const BUGFIXING_COMPRESSION_GUIDANCE: Record<number, string> = {
  0: "",

  1: `
MILD CONSOLIDATION

Keep ALL findings. Only combine:
- Duplicate error messages
- Same file references

NEVER remove:
- Error messages
- Stack traces
- Root cause findings
- Failed fix attempts
`,

  2: `
MODERATE CONSOLIDATION

Keep ALL unique findings. Only remove:
- Exact duplicate error references

Keep:
- Every unique error message
- Every root cause finding
- All attempted fixes (success and failure)
`,
};

export const BUGFIXING_CONTEXT_INSTRUCTIONS = `
Use these bug investigation findings to apply a fix.

For each finding:
- Note the exact error message and location
- Include the root cause if identified
- Document what was attempted and what worked

The fix should address the root cause, not just symptoms.
`;

// ============================================================================
// REFACTORING MODE PROMPTS
// ============================================================================

export const REFACTORING_TASK_CONTEXT = `
You are refactoring code. Your memory will track what was changed and dependencies.

YOUR OBJECTIVE:
\${refactorGoal}

Focus on:
- Files that need modification
- Interface changes (breaking)
- Test files that need updates
- Dependencies that are affected
`;

export const REFACTORING_EXTRACTION_INSTRUCTIONS = `
Capture refactoring details:

1. INTERFACE CHANGES - Function signatures, class APIs that changed
2. FILES AFFECTED - All files touched or needing updates
3. BREAKING CHANGES - Anything that might break dependent code
4. TEST UPDATES - Test files that need modification
5. DEPENDENCIES - What depends on the code being changed
`;

export const REFACTORING_OUTPUT_FORMAT = `
<refactoring_plan>
## Target
- What: [what you're refactoring]
- Goal: [why - better design, performance, etc.]

## Changes Required
### Files to Modify
- [file1]: [what changes]
- [file2]: [what changes]

### Interface Changes
- [old signature] → [new signature] (BREAKING?)

### Dependent Files (need updates)
- [file3] uses [old thing]
- [file4] uses [old thing]

### Test Files (need updates)
- [test1]: [what needs change]
</refactoring_plan>
`;

export const REFACTORING_GUIDELINES = `
PRIORITY:
1. Interface/API changes and their impact
2. Breaking changes identification
3. Files affected
4. Dependencies and dependents

WHAT TO CAPTURE:
- Full function/class signatures before and after
- All files that depend on changed interfaces
- Breaking changes with migration notes
- Test files that need updates

DO NOT:
- Skip breaking change documentation
- Forget dependent files
- Lose interface signatures
`;

export const REFACTORING_COMPRESSION_GUIDANCE: Record<number, string> = {
  0: "",

  1: `
MILD CONSOLIDATION

Keep ALL findings. Only combine:
- Duplicate file references

NEVER remove:
- Interface changes
- Breaking changes
- Dependent files
`,

  2: `
MODERATE CONSOLIDATION

Keep ALL unique findings. Only remove:
- Exact duplicate file references

Keep:
- Every interface change
- All breaking changes
- Dependent file list
`,
};

export const REFACTORING_CONTEXT_INSTRUCTIONS = `
Use these refactoring findings to make code changes.

For each change:
- Note the old and new interface signatures
- Identify dependent files that need updates
- Document any breaking changes

Apply changes systematically, updating dependents first.
`;

// ============================================================================
// TESTING MODE PROMPTS
// ============================================================================

export const TESTING_TASK_CONTEXT = `
You are writing or running tests. Your memory tracks test coverage and results.

YOUR OBJECTIVE:
\${testingGoal}

Focus on:
- Test files created/modified
- Coverage changes
- Test results (pass/fail)
- What is being tested
`;

export const TESTING_EXTRACTION_INSTRUCTIONS = `
Capture testing details:

1. TEST FILES - Which files were created/modified
2. COVERAGE - What areas are covered
3. TEST RESULTS - Pass/fail for each test
4. WHAT'S TESTED - Functions/scenarios covered
`;

export const TESTING_OUTPUT_FORMAT = `
<test_summary>
## Tests Added/Modified
- [test_file1]: [N tests for X]
- [test_file2]: [N tests for Y]

## Coverage
- Before: [X%]
- After: [Y%]
- New coverage: [areas covered]

## Results
- [test_name]: PASS/FAIL
</test_summary>
`;

export const TESTING_GUIDELINES = `
PRIORITY:
1. Test files created/modified
2. Test results (pass/fail)
3. Coverage changes
4. What scenarios are covered

WHAT TO CAPTURE:
- Test file paths
- Individual test names and results
- Coverage percentage changes
- Test patterns being used

DO NOT:
- Skip failed test details
- Forget to note coverage changes
- Lose test file paths
`;

export const TESTING_COMPRESSION_GUIDANCE: Record<number, string> = {
  0: "",

  1: `
MILD CONSOLIDATION

Keep ALL findings. Only combine:
- Duplicate test file references

NEVER remove:
- Test results (pass/fail)
- Coverage percentages
- Test file paths
`,

  2: `
MODERATE CONSOLIDATION

Keep ALL unique findings. Only remove:
- Exact duplicate test references

Keep:
- All test results
- Coverage changes
- Test file list
`,
};

export const TESTING_CONTEXT_INSTRUCTIONS = `
Use these testing findings to improve test coverage.

For each finding:
- Note which tests passed/failed
- Track coverage gaps
- Identify which files need more tests

Focus on improving coverage in areas that affect the application most.
`;

// ============================================================================
// DEBUGGING MODE PROMPTS
// ============================================================================

export const DEBUGGING_TASK_CONTEXT = `
You are debugging an issue. Your memory tracks symptoms and investigation.

YOUR OBJECTIVE:
\${debugGoal}

Focus on:
- Symptoms observed
- Variables/state at different points
- What was tested/tried
- Findings
`;

export const DEBUGGING_EXTRACTION_INSTRUCTIONS = `
Capture debugging session details:

1. SYMPTOMS - What was observed (errors, behavior, output)
2. VARIABLES - State at key points in execution
3. INVESTIGATION - What was checked and found
4. HYPOTHESES - What might be causing the issue
5. FINDINGS - What was discovered
`;

export const DEBUGGING_OUTPUT_FORMAT = `
<debug_session>
## Symptoms
- Observed: [what's wrong]
- When: [when it occurs]
- Reproducible: [yes/no]

## Investigation
- Checked: [what you looked at]
- Found: [what you discovered]

## Variables/State
- At point A: [state]
- At point B: [state]

## Conclusion
- Root cause: [if found]
- Fix: [if applied]
</debug_session>
`;

export const DEBUGGING_GUIDELINES = `
PRIORITY:
1. Symptoms observed
2. Variable states at key points
3. Investigation steps
4. Root cause findings

WHAT TO CAPTURE:
- Exact symptom descriptions
- Variable values at breakpoints
- Investigation steps taken
- What was ruled out

DO NOT:
- Skip symptoms
- Forget variable states
- Lose investigation steps
`;

export const DEBUGGING_COMPRESSION_GUIDANCE: Record<number, string> = {
  0: "",

  1: `
MILD CONSOLIDATION

Keep ALL findings. Only combine:
- Duplicate investigation steps

NEVER remove:
- Symptoms
- Variable states
- Root cause findings
`,

  2: `
MODERATE CONSOLIDATION

Keep ALL unique findings. Only remove:
- Exact duplicate steps

Keep:
- All symptoms
- Key variable states
- Root cause
`,
};

export const DEBUGGING_CONTEXT_INSTRUCTIONS = `
Use these debugging findings to identify and fix the issue.

For each finding:
- Document the symptoms observed
- Note variable states that led to findings
- Track the root cause

Use these clues to trace and fix the root cause.
`;

// ============================================================================
// RESEARCH MODE PROMPTS
// ============================================================================

export const RESEARCH_TASK_CONTEXT = `
You are researching information. Your memory tracks sources and findings.

YOUR OBJECTIVE:
\${researchGoal}

Focus on:
- Sources consulted (URLs, docs)
- Findings and discoveries
- Best practices found
- Alternatives considered
`;

export const RESEARCH_EXTRACTION_INSTRUCTIONS = `
Capture research details:

1. SOURCES - URLs, documentation, books consulted
2. FINDINGS - Key discoveries and insights
3. BEST PRACTICES - Recommended approaches
4. ALTERNATIVES - Options considered
5. RECOMMENDATIONS - What to use and why
`;

export const RESEARCH_OUTPUT_FORMAT = `
<research_findings>
## Research Question
- [what was being researched]

## Sources Consulted
- [source1]: [URL/brief description]
- [source2]: [URL/brief description]

## Key Findings
- Finding 1: [description]
- Finding 2: [description]

## Best Practices
- [practice 1]: [description]
- [practice 2]: [description]

## Alternatives Considered
- [alternative 1]: [pros/cons]
- [alternative 2]: [pros/cons]

## Recommendations
- Recommended: [what to use]
- Rationale: [why]
</research_findings>
`;

export const RESEARCH_GUIDELINES = `
PRIORITY:
1. Sources and where information came from
2. Key findings and insights
3. Best practices discovered
4. Documentation references
5. Recommendations

WHAT TO CAPTURE:
- Exact URLs and source names
- Key findings with details
- Best practices with examples
- Documentation references
- Pros/cons of alternatives

DO NOT:
- Forget source URLs
- Skip best practices
- Lose recommendations
`;

export const RESEARCH_COMPRESSION_GUIDANCE: Record<number, string> = {
  0: "",

  1: `
MILD CONSOLIDATION

Keep ALL findings. Only combine:
- Duplicate source references

NEVER remove:
- Source URLs
- Key findings
- Best practices
- Recommendations
`,

  2: `
MODERATE CONSOLIDATION

Keep ALL unique findings. Only remove:
- Exact duplicate source references

Keep:
- All unique sources
- Key findings
- Best practices
- Recommendations
`,
};

export const RESEARCH_CONTEXT_INSTRUCTIONS = `
Use these research findings to inform decisions.

For each finding:
- Note the source for credibility
- Consider best practices
- Weigh alternatives

Base decisions on the best available information.
`;

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

export interface ModePrompts {
  taskContext: string;
  extractionInstructions: string;
  outputFormat: string;
  guidelines: string;
  compressionGuidance: Record<number, string>;
  contextInstructions: string;
}

export const MODE_PROMPTS: Record<AgentMode, ModePrompts> = {
  default: {
    taskContext: "",
    extractionInstructions: OBSERVER_EXTRACTION_INSTRUCTIONS,
    outputFormat: OBSERVER_OUTPUT_FORMAT,
    guidelines: OBSERVER_GUIDELINES,
    compressionGuidance: {},
    contextInstructions: "",
  },
  explore: {
    taskContext: EXPLORER_TASK_CONTEXT,
    extractionInstructions: EXPLORER_TASK_CONTEXT,
    outputFormat: EXPLORER_OUTPUT_FORMAT,
    guidelines: EXPLORER_GUIDELINES,
    compressionGuidance: EXPLORER_COMPRESSION_GUIDANCE,
    contextInstructions: EXPLORER_CONTEXT_INSTRUCTIONS,
  },
  bug_fixing: {
    taskContext: BUGFIXING_TASK_CONTEXT,
    extractionInstructions: BUGFIXING_EXTRACTION_INSTRUCTIONS,
    outputFormat: BUGFIXING_OUTPUT_FORMAT,
    guidelines: BUGFIXING_GUIDELINES,
    compressionGuidance: BUGFIXING_COMPRESSION_GUIDANCE,
    contextInstructions: BUGFIXING_CONTEXT_INSTRUCTIONS,
  },
  refactoring: {
    taskContext: REFACTORING_TASK_CONTEXT,
    extractionInstructions: REFACTORING_EXTRACTION_INSTRUCTIONS,
    outputFormat: REFACTORING_OUTPUT_FORMAT,
    guidelines: REFACTORING_GUIDELINES,
    compressionGuidance: REFACTORING_COMPRESSION_GUIDANCE,
    contextInstructions: REFACTORING_CONTEXT_INSTRUCTIONS,
  },
  testing: {
    taskContext: TESTING_TASK_CONTEXT,
    extractionInstructions: TESTING_EXTRACTION_INSTRUCTIONS,
    outputFormat: TESTING_OUTPUT_FORMAT,
    guidelines: TESTING_GUIDELINES,
    compressionGuidance: TESTING_COMPRESSION_GUIDANCE,
    contextInstructions: TESTING_CONTEXT_INSTRUCTIONS,
  },
  debugging: {
    taskContext: DEBUGGING_TASK_CONTEXT,
    extractionInstructions: DEBUGGING_EXTRACTION_INSTRUCTIONS,
    outputFormat: DEBUGGING_OUTPUT_FORMAT,
    guidelines: DEBUGGING_GUIDELINES,
    compressionGuidance: DEBUGGING_COMPRESSION_GUIDANCE,
    contextInstructions: DEBUGGING_CONTEXT_INSTRUCTIONS,
  },
  research: {
    taskContext: RESEARCH_TASK_CONTEXT,
    extractionInstructions: RESEARCH_EXTRACTION_INSTRUCTIONS,
    outputFormat: RESEARCH_OUTPUT_FORMAT,
    guidelines: RESEARCH_GUIDELINES,
    compressionGuidance: RESEARCH_COMPRESSION_GUIDANCE,
    contextInstructions: RESEARCH_CONTEXT_INSTRUCTIONS,
  },
};

export function getModePrompts(mode: AgentMode): ModePrompts {
  return MODE_PROMPTS[mode] ?? MODE_PROMPTS.default;
}

export function buildObserverSystemPrompt(mode: AgentMode): string {
  const modeInstructions = getModeExtractionInstructions(mode);

  if (mode === "explore") {
    return `You are a precise codebase researcher. Your findings will be used by another agent to make decisions.

${EXPLORER_TASK_CONTEXT}

=== EXTRACTION INSTRUCTIONS ===

${modeInstructions}

=== OUTPUT FORMAT ===

${EXPLORER_OUTPUT_FORMAT}

=== GUIDELINES ===

${EXPLORER_GUIDELINES}

IMPORTANT: You are not implementing code - you are finding information. Be precise.
The parent agent needs exact details to make decisions about the codebase.

Remember: Accuracy > Brevity. Parent agent will act on what you remember.
`;
  }

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
