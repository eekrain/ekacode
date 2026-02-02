/**
 * Workflow engine for orchestration
 *
 * Manages the explore → plan → build workflow with parallel
 * exploration and sequential planning/building.
 */

import type { EventEmitter } from "events";
import {
  createBuildAgent,
  createExploreAgent,
  createPlanAgent,
  runAgent,
} from "../agent/workflow/factory";
import { AgentEvent, AgentResult } from "../agent/workflow/types";
import { Checkpoint, SessionPhase } from "../session/types";
import type { CheckpointSaver, WorkflowEvent } from "./types";

/**
 * Workflow engine class
 *
 * Orchestrates the three-phase workflow: exploration, planning, and building.
 */
export class WorkflowEngine {
  private sessionId: string;
  private task = "";
  private phase: SessionPhase = "idle";
  private eventBus: EventEmitter;
  private checkpointSaver: CheckpointSaver;

  // Results storage
  private exploreResults: AgentResult[] = [];
  private planResult: AgentResult | null = null;
  private buildResult: AgentResult | null = null;

  // Active agents tracking
  private activeAgents = new Map<string, AbortController>();

  constructor(sessionId: string, eventBus: EventEmitter, checkpointSaver: CheckpointSaver) {
    this.sessionId = sessionId;
    this.eventBus = eventBus;
    this.checkpointSaver = checkpointSaver;
  }

  /**
   * Start the workflow with a task
   *
   * @param task - The user's task/goal
   * @param exploreInputs - Optional custom inputs for exploration agents
   */
  async start(task: string, exploreInputs?: string[]): Promise<void> {
    this.task = task;
    this.phase = "exploring";

    await this.saveCheckpoint();

    // Phase 1: Explore (3 parallel agents)
    const inputs = exploreInputs || [
      `Explore the codebase structure for: ${task}`,
      `Find relevant files and patterns for: ${task}`,
      `Analyze dependencies and architecture for: ${task}`,
    ];

    await this.runExplorationPhase(inputs);

    // Phase 2: Plan (sequential)
    this.phase = "planning";
    await this.saveCheckpoint();
    await this.runPlanningPhase();

    // Phase 3: Build (sequential)
    this.phase = "building";
    await this.saveCheckpoint();
    await this.runBuildPhase();

    // Complete
    this.phase = "completed";
    await this.saveCheckpoint();

    this.emitEvent({
      type: "WORKFLOW_COMPLETED",
      sessionId: this.sessionId,
      results: {
        explore: this.exploreResults,
        plan: this.planResult,
        build: this.buildResult,
      },
    });
  }

  /**
   * Resume workflow from a checkpoint
   *
   * @param checkpoint - The checkpoint to resume from
   */
  async resumeFromCheckpoint(checkpoint: Checkpoint): Promise<void> {
    // Restore state
    this.task = checkpoint.task;
    this.phase = checkpoint.phase;
    this.exploreResults = checkpoint.exploreResults || [];
    this.planResult = checkpoint.planResult || null;
    this.buildResult = checkpoint.buildResult || null;

    // Resume from current phase
    switch (checkpoint.phase) {
      case "exploring":
        // Check which explorers completed
        const completedExplorers = new Set(
          checkpoint.agentStates
            ?.filter(s => s.type === "explore" && s.status === "completed")
            .map(s => s.agentId) || []
        );

        // Resume incomplete explorers
        const inputs = [
          `Explore the codebase structure for: ${this.task}`,
          `Find relevant files and patterns for: ${this.task}`,
          `Analyze dependencies and architecture for: ${this.task}`,
        ];

        const remainingInputs = inputs.filter(
          (_, idx) => !completedExplorers.has(`explore-${idx}`)
        );

        if (remainingInputs.length > 0) {
          await this.runExplorationPhase(remainingInputs, checkpoint.agentStates);
        }

        // Continue to planning if all done
        if (this.exploreResults.length === 3) {
          this.phase = "planning";
          await this.saveCheckpoint();
          await this.runPlanningPhase();
          this.phase = "building";
          await this.saveCheckpoint();
          await this.runBuildPhase();
        }
        break;

      case "planning":
        await this.runPlanningPhase();
        this.phase = "building";
        await this.saveCheckpoint();
        await this.runBuildPhase();
        break;

      case "building":
        await this.runBuildPhase();
        break;
    }

    this.phase = "completed";
    await this.saveCheckpoint();
  }

  /**
   * Run the exploration phase with 3 parallel agents
   */
  private async runExplorationPhase(inputs: string[], restoredStates?: unknown[]): Promise<void> {
    this.emitEvent({
      type: "PHASE_STARTED",
      sessionId: this.sessionId,
      phase: "exploring",
    });

    // Create 3 explore agents with their inputs
    const agents = inputs.map((input, idx) => ({
      config: createExploreAgent(idx),
      input: { task: input },
      restoredState: restoredStates?.find(
        (s: unknown) => (s as { agentId: string }).agentId === `explore-${idx}`
      ),
    }));

    // Run in parallel with Promise.all
    const promises = agents.map(async ({ config, input, restoredState }) => {
      const abortController = new AbortController();
      this.activeAgents.set(config.id, abortController);

      // If restored state exists, restore messages
      const agentInput = restoredState
        ? {
            ...input,
            context: {
              restoredMessages: (restoredState as { messages: unknown[] }).messages,
              restoredIteration: (restoredState as { iterationCount: number }).iterationCount,
            },
          }
        : input;

      const result = await runAgent(config, agentInput, (event: unknown) => {
        this.emitEvent({
          type: "AGENT_EVENT",
          sessionId: this.sessionId,
          event: event as AgentEvent,
        });
      });

      this.activeAgents.delete(config.id);
      return result;
    });

    // Wait for all to complete
    const results = await Promise.all(promises);
    this.exploreResults = results;

    this.emitEvent({
      type: "PHASE_COMPLETED",
      sessionId: this.sessionId,
      phase: "exploring",
      results: this.exploreResults,
    });

    await this.saveCheckpoint();
  }

  /**
   * Run the planning phase
   */
  private async runPlanningPhase(): Promise<void> {
    this.emitEvent({
      type: "PHASE_STARTED",
      sessionId: this.sessionId,
      phase: "planning",
    });

    const config = createPlanAgent();
    const input = {
      task: this.task,
      previousResults: this.exploreResults,
    };

    this.planResult = await runAgent(config, input, (event: unknown) => {
      this.emitEvent({
        type: "AGENT_EVENT",
        sessionId: this.sessionId,
        event: event as AgentEvent,
      });
    });

    this.emitEvent({
      type: "PHASE_COMPLETED",
      sessionId: this.sessionId,
      phase: "planning",
      results: this.planResult,
    });

    await this.saveCheckpoint();
  }

  /**
   * Run the building phase
   */
  private async runBuildPhase(): Promise<void> {
    this.emitEvent({
      type: "PHASE_STARTED",
      sessionId: this.sessionId,
      phase: "building",
    });

    const config = createBuildAgent();
    const input = {
      task: this.task,
      context: { plan: this.planResult?.finalContent },
      previousResults: this.planResult ? [this.planResult] : [],
    };

    this.buildResult = await runAgent(config, input, (event: unknown) => {
      this.emitEvent({
        type: "AGENT_EVENT",
        sessionId: this.sessionId,
        event: event as AgentEvent,
      });
    });

    this.emitEvent({
      type: "PHASE_COMPLETED",
      sessionId: this.sessionId,
      phase: "building",
      results: this.buildResult,
    });

    await this.saveCheckpoint();
  }

  /**
   * Save checkpoint for current state
   */
  private async saveCheckpoint(): Promise<void> {
    const checkpoint: Checkpoint = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      phase: this.phase,
      task: this.task,
      exploreResults: this.exploreResults,
      planResult: this.planResult || undefined,
      buildResult: this.buildResult || undefined,
      agentStates: Array.from(this.activeAgents.entries()).map(([agentId]) => ({
        agentId,
        type: agentId.startsWith("explore") ? "explore" : agentId === "planner" ? "plan" : "build",
        status: "running",
        messages: [],
        iterationCount: 0,
      })),
    };

    await this.checkpointSaver(checkpoint);
  }

  /**
   * Get current workflow status
   */
  getStatus(): {
    sessionId: string;
    phase: SessionPhase;
    progress: number;
    hasIncompleteWork: boolean;
    summary: string;
    lastActivity: number;
    activeAgents: string[];
  } {
    const phaseOrder: SessionPhase[] = ["idle", "exploring", "planning", "building", "completed"];
    const progress = (phaseOrder.indexOf(this.phase) / (phaseOrder.length - 1)) * 100;

    return {
      sessionId: this.sessionId,
      phase: this.phase,
      progress,
      hasIncompleteWork: this.phase !== "completed" && this.phase !== "idle",
      summary: this.generateSummary(),
      lastActivity: Date.now(),
      activeAgents: Array.from(this.activeAgents.keys()),
    };
  }

  /**
   * Generate a summary of current status
   */
  private generateSummary(): string {
    switch (this.phase) {
      case "exploring":
        return `Exploration: ${this.exploreResults.length}/3 agents completed`;
      case "planning":
        return "Planning: Creating implementation plan";
      case "building":
        return "Building: Implementing the solution";
      case "completed":
        return "All phases completed";
      default:
        return "Ready to start";
    }
  }

  /**
   * Abort all active agents
   */
  abort(): void {
    for (const [, controller] of this.activeAgents) {
      controller.abort();
    }
    this.activeAgents.clear();
  }

  /**
   * Emit an event through the event bus
   */
  private emitEvent(event: WorkflowEvent): void {
    this.eventBus.emit(event.type, event);
  }
}
