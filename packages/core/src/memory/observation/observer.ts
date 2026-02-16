/**
 * Observer Agent - Phase 2 Observation
 *
 * LLM agent that extracts observations from messages.
 * Creates narrative summaries that help the assistant remember past work.
 */

import type { LanguageModelV3 } from "@ai-sdk/provider";
import { generateText } from "ai";
import { OBSERVER_SYSTEM_PROMPT } from "../../prompts/memory/observer/observer";
import type { ObservationMessage } from "./storage";

export interface ObserverInput {
  existingObservations: string;
  messages: ObservationMessage[];
}

export interface ObserverOutput {
  observations: string;
  currentTask?: string;
  suggestedResponse?: string;
  tokenCount: number;
}

/**
 * Call the Observer Agent to extract observations from messages
 *
 * @param input - Observer input with existing observations and new messages
 * @param model - Language model to use for observation extraction
 * @param timeoutMs - Timeout in milliseconds (default 30000)
 * @returns Observer output with observations, current task, and suggested response
 */
export async function callObserverAgent(
  input: ObserverInput,
  model: LanguageModelV3,
  timeoutMs: number = 30000
): Promise<ObserverOutput> {
  const { existingObservations, messages } = input;

  const systemPrompt = OBSERVER_SYSTEM_PROMPT;

  const userPrompt = buildUserPrompt(existingObservations, messages);

  const result = await Promise.race([
    generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      timeout: timeoutMs,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Observer timeout")), timeoutMs)
    ),
  ]);

  const text = result.text;
  const output = parseObserverOutput(text);

  const tokenCount = (result.usage as { total?: number })?.total ?? 0;

  return {
    observations: output.observations,
    currentTask: output.currentTask,
    suggestedResponse: output.suggestedResponse,
    tokenCount,
  };
}

/**
 * Build user prompt with messages formatted for observation
 */
function buildUserPrompt(existingObservations: string, messages: ObservationMessage[]): string {
  const lines: string[] = [];

  if (existingObservations) {
    lines.push("Existing observations:");
    lines.push(existingObservations);
    lines.push("");
  }

  lines.push("Messages to observe:");

  for (const msg of messages) {
    const timestamp = msg.createdAt
      ? new Date(msg.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "00:00";
    lines.push(`[${timestamp}] ${msg.role}: ${msg.content}`);
  }

  lines.push("");
  lines.push("Please extract observations from these messages.");

  return lines.join("\n");
}

/**
 * Parse observer output to extract observations, current-task, and suggested-response
 */
export function parseObserverOutput(text: string): Omit<ObserverOutput, "tokenCount"> {
  const observationsMatch = text.match(/<observations>([\s\S]*?)<\/observations>/);
  const currentTaskMatch = text.match(/<current-task>([\s\S]*?)<\/current-task>/);
  const suggestedResponseMatch = text.match(/<suggested-response>([\s\S]*?)<\/suggested-response>/);

  return {
    observations: observationsMatch?.[1]?.trim() ?? text,
    currentTask: currentTaskMatch?.[1]?.trim(),
    suggestedResponse: suggestedResponseMatch?.[1]?.trim(),
  };
}
