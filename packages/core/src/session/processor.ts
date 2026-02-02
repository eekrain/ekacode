/**
 * Agent processor for opencode-style agent loop
 *
 * This class handles the main loop for agent execution, including
 * streaming LLM responses, tool execution, and doom loop detection.
 */

import type { LanguageModelV3 } from "@ai-sdk/provider";
import { streamText } from "ai";
import { getBuildModel, getExploreModel, getPlanModel } from "../agent/workflow/model-provider";
import { AgentConfig, AgentEvent, AgentInput, AgentResult } from "../agent/workflow/types";
import { Instance } from "../instance";

const DOOM_LOOP_THRESHOLD = 3;

// Type for streamText result
type StreamTextOutput = Awaited<ReturnType<typeof streamText>>;

/**
 * Agent processor class
 *
 * Manages the execution loop for a single agent, including
 * LLM streaming, tool execution, and event emission.
 */
export class AgentProcessor {
  private config: AgentConfig;
  private abortController: AbortController;
  private eventCallback: (event: AgentEvent) => void;
  private messages: unknown[] = [];
  private iterationCount = 0;
  private toolCallHistory: string[] = [];

  constructor(config: AgentConfig, eventCallback: (event: AgentEvent) => void) {
    this.config = config;
    this.abortController = new AbortController();
    this.eventCallback = eventCallback;
  }

  /**
   * Run the agent with the given input
   *
   * Main execution loop that handles LLM streaming and tool calls.
   */
  async run(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();

    // Initialize with system prompt and user input
    this.messages = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: this.buildInputMessage(input) },
    ];

    try {
      while (this.iterationCount < this.config.maxIterations) {
        // Check for abort
        if (this.abortController.signal.aborted) {
          return this.createResult("stopped", startTime);
        }

        // Stream from LLM
        const stream = await this.streamIteration();

        // Process stream events
        const iterationResult = await this.processStream(stream);

        if (iterationResult.finished) {
          return this.createResult("completed", startTime);
        }

        // Doom loop detection
        if (this.detectDoomLoop()) {
          return this.createResult("failed", startTime, "Doom loop detected");
        }

        this.iterationCount++;
      }

      return this.createResult("completed", startTime, "Max iterations reached");
    } catch (error) {
      return this.createResult(
        "failed",
        startTime,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Stream a single iteration from the LLM
   */
  private async streamIteration() {
    // Access context to ensure we're in an Instance.provide() context
    void Instance.context;

    return streamText({
      model: this.getModel(),
      messages: this.messages as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      tools: this.config.tools as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      abortSignal: this.abortController.signal,
      temperature: this.config.temperature,
    });
  }

  /**
   * Process the stream from the LLM
   */
  private async processStream(stream: StreamTextOutput): Promise<{ finished: boolean }> {
    let assistantMessage = "";
    let toolCalls: Array<{ name: string; args: Record<string, unknown>; id: string }> = [];
    let finishReason: string | null = null;

    for await (const chunk of stream.fullStream) {
      switch (chunk.type) {
        case "text-delta":
          assistantMessage += chunk.text;
          this.emitEvent({
            type: "text",
            text: chunk.text,
            agentId: this.config.id,
          });
          break;

        case "tool-call":
          toolCalls.push({
            name: chunk.toolName,
            args: chunk.input as Record<string, unknown>,
            id: chunk.toolCallId,
          });
          this.emitEvent({
            type: "tool-call",
            toolName: chunk.toolName,
            args: chunk.input,
            agentId: this.config.id,
          });
          break;

        case "tool-result":
          this.messages.push({
            role: "tool",
            content: JSON.stringify(chunk.output),
            tool_call_id: chunk.toolCallId,
          });
          this.emitEvent({
            type: "tool-result",
            toolName: chunk.toolName,
            result: chunk.output,
            agentId: this.config.id,
          });
          break;

        case "finish":
          finishReason = chunk.finishReason;
          this.emitEvent({
            type: "finish",
            finishReason: chunk.finishReason,
            agentId: this.config.id,
          });
          break;

        case "error":
          throw chunk.error;
      }
    }

    // Add assistant message
    if (assistantMessage) {
      this.messages.push({
        role: "assistant",
        content: assistantMessage,
        tool_calls:
          toolCalls.length > 0
            ? toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: JSON.stringify(tc.args) },
              }))
            : undefined,
      });
    }

    // Execute tool calls (handled automatically by AI SDK)
    if (toolCalls.length > 0) {
      // Track for doom loop detection
      const toolSignature = toolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.args)}`).join("|");
      this.toolCallHistory.push(toolSignature);

      return { finished: false };
    }

    // Check finish reason
    if (finishReason === "stop") {
      return { finished: true };
    }

    return { finished: false };
  }

  /**
   * Detect doom loop from tool call history
   */
  private detectDoomLoop(): boolean {
    if (this.toolCallHistory.length < DOOM_LOOP_THRESHOLD) return false;

    const lastThree = this.toolCallHistory.slice(-DOOM_LOOP_THRESHOLD);
    return lastThree.every(sig => sig === lastThree[0]);
  }

  /**
   * Build the input message from task, context, and previous results
   */
  private buildInputMessage(input: AgentInput): string {
    let message = input.task;

    if (input.context && Object.keys(input.context).length > 0) {
      message += "\n\nContext:\n" + JSON.stringify(input.context, null, 2);
    }

    if (input.previousResults && input.previousResults.length > 0) {
      message +=
        "\n\nPrevious Results:\n" +
        input.previousResults.map(r => `[${r.type}] ${r.finalContent || r.error}`).join("\n---\n");
    }

    return message;
  }

  /**
   * Create an agent result
   */
  private createResult(
    status: "completed" | "failed" | "stopped",
    startTime: number,
    errorOrMessage?: string
  ): AgentResult {
    return {
      agentId: this.config.id,
      type: this.config.type,
      status,
      messages: this.messages,
      finalContent: status === "completed" ? this.getLastAssistantMessage() : undefined,
      error: status === "failed" ? errorOrMessage : undefined,
      iterations: this.iterationCount,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Get the last assistant message from the history
   */
  private getLastAssistantMessage(): string {
    const lastMessage = this.messages
      .reverse()
      .find(m => m && typeof m === "object" && "role" in m && m.role === "assistant");
    return lastMessage && typeof lastMessage === "object" && "content" in lastMessage
      ? (lastMessage as { content: string }).content
      : "";
  }

  /**
   * Get the model for this agent based on agent type
   */
  private getModel(): LanguageModelV3 {
    switch (this.config.type) {
      case "explore":
        return getExploreModel();
      case "plan":
        return getPlanModel();
      case "build":
        return getBuildModel();
      default:
        throw new Error(`Unknown agent type: ${this.config.type}`);
    }
  }

  /**
   * Emit an event through the callback
   */
  private emitEvent(event: AgentEvent): void {
    this.eventCallback(event);
  }

  /**
   * Abort the agent execution
   */
  abort(): void {
    this.abortController.abort();
  }
}
