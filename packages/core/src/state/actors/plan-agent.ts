/**
 * Plan agent XState actor
 *
 * This module provides the plan agent that runs during the
 * research and design phases to analyze requirements and create plans.
 *
 * Uses glm-4.7 (high-quality) for planning and design decisions.
 * Safety limits: research 100, design 100 iterations (intent-based).
 */

import type { LanguageModelV3Message } from "@ai-sdk/provider";
import { streamText } from "ai";
import { fromPromise } from "xstate";
import { planModel } from "../integration/model-provider";
import { PLAN_PHASE_NOTICES } from "../prompts/plan-prompts";
import { getAnalyzeCodeToolMap, getDesignToolMap, getResearchToolMap } from "../tools/phase-tools";
import type { AgentRuntime, Message, MessageRole, PlanPhase } from "../types";
import { PHASE_SAFETY_LIMITS, toCoreMessages } from "../types";
import { isTestMode, throwIfAborted } from "./runtime";

/**
 * Input interface for plan agent
 */
export interface PlanAgentInput {
  messages: Array<Message>;
  phase: PlanPhase;
  runtime?: AgentRuntime;
}

/**
 * Output interface for plan agent
 */
export interface PlanAgentOutput {
  output: string;
  finishReason: string | null | undefined;
  messages: Array<Message>;
}

/**
 * Get tool map for a specific plan phase
 */
function getToolMapForPhase(phase: PlanPhase): Record<string, unknown> {
  switch (phase) {
    case "analyze_code":
      return getAnalyzeCodeToolMap();
    case "research":
      return getResearchToolMap();
    case "design":
      return getDesignToolMap();
  }
}

/**
 * Convert CoreMessage back to our Message type
 * Handles both LanguageModelV3Message and ResponseMessage types
 */
function fromCoreMessages(messages: unknown): Array<Message> {
  const msgs = messages as Array<{
    role: string;
    content: string | unknown;
    toolCalls?: Array<{ toolCallId: string; toolName: string; args: Record<string, unknown> }>;
    toolCallId?: string;
    result?: unknown;
  }>;

  return msgs.map(msg => {
    const base = {
      role: msg.role as MessageRole,
      content: String(msg.content ?? ""),
    };

    if (base.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        ...base,
        role: "assistant" as const,
        toolCalls: msg.toolCalls.map(toolCall => ({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args: toolCall.args,
        })),
      };
    }

    if (base.role === "tool") {
      return {
        ...base,
        role: "tool" as const,
        toolCallId: String(msg.toolCallId ?? ""),
        result: msg.result,
      };
    }

    return base;
  });
}

/**
 * Run plan agent actor
 *
 * Uses glm-4.7 for high-quality planning decisions.
 * Safety limits: research 100, design 100 iterations (intent-based).
 *
 * @returns XState actor logic for the plan agent
 */
export const runPlanAgent = fromPromise(async ({ input }: { input: PlanAgentInput }) => {
  const { messages, phase, runtime } = input;

  if (isTestMode(runtime)) {
    return {
      output: `[Plan Agent:${phase}] Test mode output`,
      finishReason: "stop",
      messages: [],
    } as PlanAgentOutput;
  }

  throwIfAborted(runtime);
  const safetyLimit = PHASE_SAFETY_LIMITS[phase];

  // Get tool map for the phase
  const toolMap = getToolMapForPhase(phase);

  // Get system prompt for the phase
  const systemPrompt = PLAN_PHASE_NOTICES[phase];

  let currentMessages = [...messages, { role: "system" as const, content: systemPrompt }];
  let iterationCount = 0;
  let finishReason: string | null | undefined = null;
  let fullResponse = "";

  // Multi-turn loop with intent-based completion
  while (iterationCount < safetyLimit) {
    throwIfAborted(runtime);
    iterationCount++;

    // Convert our messages to CoreMessage format for AI SDK v6
    const coreMessages = toCoreMessages(currentMessages) as LanguageModelV3Message[];

    // Call the model with streamText
    const result = await streamText({
      model: planModel,
      messages: coreMessages,
      tools: toolMap as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- AI SDK ToolSet type incompatibility
    });

    // Consume the text stream
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
    }

    // Get final response with finishReason and messages
    // finishReason and response are promises that resolve
    finishReason = await result.finishReason;
    const finalResponse = await result.response;

    // Convert CoreMessage back to our Message type
    currentMessages = fromCoreMessages(finalResponse.messages);

    // Check if we should continue (intent-based)
    if (finishReason === "stop") {
      console.log(`[Plan Agent: ${phase}] Complete (${iterationCount} iterations)`);
      break;
    }
    if (finishReason === "tool-calls") {
      // Continue to next iteration for more tool calls
      continue;
    }
    if (iterationCount >= safetyLimit) {
      console.warn(`[Plan Agent: ${phase}] Safety limit reached (${safetyLimit} iterations)`);
      break;
    }
  }

  return {
    output: fullResponse,
    finishReason,
    messages: currentMessages,
  } as PlanAgentOutput;
});
