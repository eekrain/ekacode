/**
 * XState hierarchical state machine for Plan/Build agent orchestration
 *
 * This module defines the main RLM (Recursive Language Model) workflow
 * state machine using XState v5.
 */

import type { DoneActorEvent } from "xstate";
import { assign, setup } from "xstate";
import type { BuildAgentOutput, ExploreAgentOutput, PlanAgentOutput } from "./actors";
import { runBuildAgent, runPlanAgent, spawnExploreAgent } from "./actors";
import { hasValidationErrors as checkValidationErrors } from "./guards/doom-loop";
import type { Message, RLMMachineContext, RLMMachineEvent } from "./types";

/**
 * XState machine setup with types, actions, actors, and guards
 */
const machineSetup = setup({
  types: {
    context: {} as RLMMachineContext,
    events: {} as RLMMachineEvent,
    input: {} as Partial<RLMMachineContext>,
  },
  actions: {
    setLastState: assign({
      lastState: (context, params: { state: string }) => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.log(`State: ${params.state}`);
        }
        return params.state;
      },
    }),
    addSystemMessage: assign({
      messages: context => [
        ...(((context as unknown as RLMMachineContext).messages ?? []) as Message[]),
        { role: "system" as const, content: "" },
      ],
    }),
    addSystemMessageWithContent: assign({
      messages: (context, params: { content: string }) => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.log(`System: ${params.content}`);
        }
        return [
          ...((ctx.messages ?? []) as Message[]),
          { role: "system" as const, content: params.content },
        ];
      },
    }),
    addAssistantMessage: assign({
      messages: (context, params: { content: string }) => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.log(`Assistant: ${params.content}`);
        }
        return [
          ...((ctx.messages ?? []) as Message[]),
          { role: "assistant" as const, content: params.content },
        ];
      },
    }),
    addMessages: assign({
      messages: (context, params: { messages: Array<Message> }) => {
        const existing = ((context as unknown as RLMMachineContext).messages ?? []) as Message[];
        const incoming = params.messages ?? [];
        return [...existing, ...incoming];
      },
    }),
    setExploreResult: assign({
      spawnExploreAgentResult: (context, params: { result: string }) => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.log(`Explore result: ${params.result}`);
        }
        return params.result;
      },
    }),
    incrementIteration: assign({
      iterationCount: context => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.log("Iteration incremented");
        }
        return ctx.iterationCount + 1;
      },
    }),
    incrementToolExecution: assign({
      toolExecutionCount: context => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.log("Tool execution incremented");
        }
        return ctx.toolExecutionCount + 1;
      },
    }),
  },
  actors: {
    spawnExploreAgent,
    runPlanAgent,
    runBuildAgent,
  },
  guards: {
    hasValidationErrors: context => {
      const ctx = context as unknown as RLMMachineContext;
      if (ctx.runtime?.testMode) {
        return false;
      }
      const messages = Array.isArray(ctx.messages) ? ctx.messages : [];
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== "assistant") {
        return false;
      }
      return checkValidationErrors(lastMessage.content);
    },
    isBuildClean: context => {
      const ctx = context as unknown as RLMMachineContext;
      if (ctx.runtime?.testMode) {
        return true;
      }
      const messages = Array.isArray(ctx.messages) ? ctx.messages : [];
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== "assistant") {
        return false;
      }
      return !checkValidationErrors(lastMessage.content);
    },
  },
});

/**
 * Default context for the machine
 */
const defaultContext: RLMMachineContext = {
  messages: [],
  goal: "",
  iterationCount: 0,
  recentStates: [],
  lastState: null,
  toolExecutionCount: 0,
  errorCounts: {},
};

const buildValidateActions = [
  {
    type: "addAssistantMessage",
    params: ({ event }: { event: DoneActorEvent<BuildAgentOutput, string> }) => {
      const output = event.output as BuildAgentOutput | undefined;
      return { content: output?.output ?? "Validation complete" };
    },
  },
  { type: "incrementToolExecution" },
  {
    type: "addMessages",
    params: ({ event }: { event: DoneActorEvent<BuildAgentOutput, string> }) => {
      const output = event.output as BuildAgentOutput | undefined;
      return { messages: output?.messages ?? [] };
    },
  },
] as const;

/**
 * Hierarchical RLM state machine
 *
 * Structure:
 * - plan (analyze_code → research → design)
 * - build (implement ⇄ validate)
 * - done / failed (terminal states)
 */
export const rlmMachine = machineSetup.createMachine({
  id: "rlm",
  initial: "plan",
  context: ({ input }) => ({
    ...defaultContext,
    ...(input ?? {}),
  }),
  states: {
    // ==========================================================================
    // PLAN AGENT (Linear Progression)
    // ==========================================================================
    plan: {
      initial: "analyze_code",
      states: {
        // ------------------------------------------------------------------------
        // PHASE 1: Analyze code (spawn explore subagent)
        // ------------------------------------------------------------------------
        analyze_code: {
          entry: {
            type: "setLastState",
            params: { state: "plan.analyze_code" },
          },
          invoke: {
            src: "spawnExploreAgent",
            input: ({ context }) => ({
              messages: context.messages,
              runtime: context.runtime,
            }),
            onDone: {
              target: "research",
              actions: [
                {
                  type: "setExploreResult",
                  params: ({ event }) => {
                    const output = event.output as ExploreAgentOutput;
                    return { result: output.output ?? "explore complete" };
                  },
                },
                {
                  type: "addSystemMessageWithContent",
                  params: ({ event }) => {
                    const output = event.output as ExploreAgentOutput;
                    return {
                      content: `## EXPLORE SUBAGENT FINDINGS\n\n${output.output ?? "Explore complete"}`,
                    };
                  },
                },
                {
                  type: "addMessages",
                  params: ({ event }) => {
                    const output = event.output as ExploreAgentOutput;
                    return { messages: output.messages ?? [] };
                  },
                },
              ],
            },
          },
        },

        // ------------------------------------------------------------------------
        // PHASE 2: Research (MULTI-TURN for web search + docs lookup)
        // ------------------------------------------------------------------------
        research: {
          entry: {
            type: "setLastState",
            params: { state: "plan.research" },
          },
          invoke: {
            src: "runPlanAgent",
            input: ({ context }) => ({
              messages: context.messages,
              phase: "research",
              runtime: context.runtime,
            }),
            onDone: {
              target: "design",
              actions: [
                {
                  type: "addAssistantMessage",
                  params: ({ event }) => {
                    const output = event.output as PlanAgentOutput;
                    return { content: output.output ?? "Research complete" };
                  },
                },
                {
                  type: "addMessages",
                  params: ({ event }) => {
                    const output = event.output as PlanAgentOutput;
                    return { messages: output.messages ?? [] };
                  },
                },
              ],
            },
          },
        },

        // ------------------------------------------------------------------------
        // PHASE 3: Design (MULTI-TURN for sequential thinking)
        // ------------------------------------------------------------------------
        design: {
          entry: {
            type: "setLastState",
            params: { state: "plan.design" },
          },
          invoke: {
            src: "runPlanAgent",
            input: ({ context }) => ({
              messages: context.messages,
              phase: "design",
              runtime: context.runtime,
            }),
            onDone: {
              target: "#rlm.build",
              actions: [
                {
                  type: "addSystemMessageWithContent",
                  params: {
                    content:
                      "## HANDOVER: PLAN → BUILD\n\nThe planning phase is complete. You are now in BUILD mode.",
                  },
                },
                {
                  type: "addAssistantMessage",
                  params: ({ event }) => {
                    const output = event.output as PlanAgentOutput;
                    return { content: output.output ?? "Design complete" };
                  },
                },
                {
                  type: "addMessages",
                  params: ({ event }) => {
                    const output = event.output as PlanAgentOutput;
                    return { messages: output.messages ?? [] };
                  },
                },
              ],
            },
          },
        },
      },
    },

    // ==========================================================================
    // BUILD AGENT (Recursive Loop with Doom Loop Detection)
    // ==========================================================================
    build: {
      initial: "implement",
      states: {
        // ------------------------------------------------------------------------
        // PHASE 1: Implement (run build agent)
        // ------------------------------------------------------------------------
        implement: {
          entry: {
            type: "setLastState",
            params: { state: "build.implement" },
          },
          invoke: {
            src: "runBuildAgent",
            input: ({ context }) => ({
              messages: context.messages,
              phase: "implement",
              runtime: context.runtime,
            }),
            onDone: {
              target: "validate",
              actions: [
                {
                  type: "addAssistantMessage",
                  params: ({ event }) => {
                    const output = event.output as BuildAgentOutput;
                    return { content: output.output ?? "Implementation complete" };
                  },
                },
                { type: "incrementIteration" },
                {
                  type: "addMessages",
                  params: ({ event }) => {
                    const output = event.output as BuildAgentOutput;
                    return { messages: output.messages ?? [] };
                  },
                },
              ],
            },
          },
        },

        // ------------------------------------------------------------------------
        // PHASE 2: Validate (run build agent with LSP tools)
        // ------------------------------------------------------------------------
        validate: {
          entry: {
            type: "setLastState",
            params: { state: "build.validate" },
          },
          invoke: {
            src: "runBuildAgent",
            input: ({ context }) => ({
              messages: context.messages,
              phase: "validate",
              runtime: context.runtime,
            }),
            onDone: [
              {
                target: "#rlm.done",
                guard: ({ event, context }) => {
                  const ctx = context as unknown as RLMMachineContext;
                  if (ctx.runtime?.testMode) {
                    return true;
                  }
                  const output = (event as { output?: BuildAgentOutput }).output;
                  const content = output?.output ?? "";
                  return !checkValidationErrors(content);
                },
                actions: buildValidateActions,
              },
              {
                target: "implement",
                guard: ({ event }) => {
                  const output = (event as { output?: BuildAgentOutput }).output;
                  const content = output?.output ?? "";
                  return checkValidationErrors(content);
                },
                actions: buildValidateActions,
              },
              {
                target: "implement",
                actions: buildValidateActions,
              },
            ],
          },
        },
      },
    },

    // ==========================================================================
    // TERMINAL STATES
    // ==========================================================================
    done: {
      entry: ({ context }) => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.log("✅ RLM workflow completed successfully");
        }
      },
      type: "final",
    },
    failed: {
      entry: ({ context }) => {
        const ctx = context as unknown as RLMMachineContext;
        if (!ctx.runtime?.testMode) {
          console.error("❌ RLM workflow failed");
        }
      },
      type: "final",
    },
  },
});
