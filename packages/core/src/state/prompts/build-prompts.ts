/**
 * Build phase system prompts
 *
 * This module provides system prompts for each phase of the build agent.
 * These prompts guide the agent's behavior and tool usage during implementation.
 */

import type { BuildPhase } from "../types";

/**
 * Build phase notices - phase-specific guidance for the build agent
 *
 * Each phase has specific goals and constraints that the agent must follow.
 */
export const BUILD_PHASE_NOTICES: Record<BuildPhase, string> = {
  implement: `## PHASE 1: IMPLEMENT

You are in the implement phase of the build agent.

**Goal**: Generate code to implement the planned design.

**Tools Available**:
- readFile: Read file contents
- writeFile: Write new files
- edit: Edit existing files
- multiedit: Make multiple edits at once
- glob: Find files by pattern
- grep: Search for patterns in files
- ls: List directory contents
- bash: Run shell commands

**Safety Limit**: 50 iterations

**Instructions**:
- Follow the design plan created in the plan phase
- Write clean, maintainable code following existing patterns
- Use edit tools to make precise changes
- Test your changes incrementally
- Commit early and often when making progress
- Stop when implementation is complete or hit the safety limit

**Loop Control**:
- Continue looping while you have more code to write
- Stop when finishReason is 'stop' or you hit the safety limit
- Each iteration should make measurable progress

**Next Phase**: After implementation is complete, you'll move to validate phase.
`,

  validate: `## PHASE 2: VALIDATE

You are in the validate phase of the build agent.

**Goal**: Validate that the implementation works correctly.

**Tools Available**:
- readFile: Read file contents
- glob: Find files by pattern
- grep: Search for patterns in files
- ls: List directory contents
- bash: Run shell commands
- webSearch: Search for solutions (emergency research)
- webFetch: Fetch documentation (emergency research)

**Safety Limit**: 100 iterations

**Instructions**:
- Run tests to verify correctness
- Check for TypeScript errors, ESLint errors
- Validate edge cases and error handling
- If validation fails, return to implement phase to fix issues
- Use emergency research tools only if stuck on a problem
- Stop when all validations pass or hit the safety limit

**Loop Control**:
- If validation fails: return to implement phase
- If validation passes: move to done state
- Each iteration should either fix issues or confirm correctness

**Oscillation Warning**:
- If you oscillate between implement and validate 5+ times, you may be in a doom loop
- Consider seeking additional context or simplifying the approach
`,
};

/**
 * Get system prompt for implement phase
 *
 * @returns System prompt for the implement phase
 */
export function getImplementPrompt(): string {
  return BUILD_PHASE_NOTICES.implement;
}

/**
 * Get system prompt for validate phase
 *
 * @returns System prompt for the validate phase
 */
export function getValidatePrompt(): string {
  return BUILD_PHASE_NOTICES.validate;
}
