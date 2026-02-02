/**
 * Session controller
 *
 * Manages a single session's workflow execution, including
 * user message processing and workflow control.
 */

import { EventEmitter } from "events";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { WorkflowEngine } from "../workflow/engine";
import { Checkpoint, SessionConfig, SessionStatus } from "./types";

/**
 * Session controller class
 *
 * Orchestrates workflow execution for a single session,
 * handling user messages and workflow lifecycle.
 */
export class SessionController {
  sessionId: string;
  private workflow: WorkflowEngine;
  private eventBus: EventEmitter;
  private checkpointDir: string;
  private config: SessionConfig;
  private _isPaused = true;
  private currentCheckpoint: Checkpoint | null = null;

  constructor(config: {
    sessionId: string;
    sessionConfig: SessionConfig;
    checkpointDir: string;
    restoredCheckpoint?: Checkpoint | null;
  }) {
    this.sessionId = config.sessionId;
    this.config = config.sessionConfig;
    this.checkpointDir = config.checkpointDir;
    this.eventBus = new EventEmitter();

    // Create workflow engine
    this.workflow = new WorkflowEngine(
      this.sessionId,
      this.eventBus,
      this.saveCheckpoint.bind(this)
    );

    // If checkpoint exists, restore state
    if (config.restoredCheckpoint) {
      this.restoreState(config.restoredCheckpoint);
    }
  }

  /**
   * Start the workflow with a task
   *
   * @param task - The user's task/goal
   * @param exploreInputs - Optional custom inputs for exploration
   */
  async start(task: string, exploreInputs?: string[]): Promise<void> {
    this._isPaused = false;
    this.config.task = task;
    await this.workflow.start(task, exploreInputs);
  }

  /**
   * Continue workflow from checkpoint
   */
  async continue(): Promise<void> {
    const checkpoint = await this.loadCheckpoint();
    if (!checkpoint) {
      throw new Error("No checkpoint to continue from");
    }

    this._isPaused = false;
    await this.workflow.resumeFromCheckpoint(checkpoint);
  }

  /**
   * Process a user message - handles both new tasks and continue intents
   *
   * @param message - The user's message
   * @returns ReadableStream of events
   */
  async processUserMessage(message: string): Promise<ReadableStream> {
    // Check if user wants to continue
    if (this.isContinueIntent(message) && this.hasIncompleteWork()) {
      const status = this.getStatus();
      const intro = `Continuing our work! ${status.summary}. Resuming now...\n\n`;

      const stream = this.createEventStream();

      // Start continue in background
      this.continue().catch(error => {
        console.error("Error continuing workflow:", error);
      });

      // Prepend intro to stream
      return this.prependToStream(intro, stream);
    }

    // Treat as new task
    this._isPaused = false;
    const stream = this.createEventStream();

    // Start workflow in background
    this.start(message).catch(error => {
      console.error("Error starting workflow:", error);
    });

    return stream;
  }

  /**
   * Get current session status
   */
  getStatus(): SessionStatus {
    const workflowStatus = this.workflow.getStatus();
    return {
      sessionId: this.sessionId,
      phase: workflowStatus.phase,
      progress: workflowStatus.progress,
      hasIncompleteWork: workflowStatus.hasIncompleteWork,
      summary: workflowStatus.summary,
      lastActivity: workflowStatus.lastActivity,
      activeAgents: workflowStatus.activeAgents,
    };
  }

  /**
   * Check if session has incomplete work
   */
  hasIncompleteWork(): boolean {
    const status = this.getStatus();
    return status.hasIncompleteWork;
  }

  /**
   * Check if a checkpoint exists on disk
   */
  async hasCheckpoint(): Promise<boolean> {
    try {
      const checkpointPath = join(this.checkpointDir, "checkpoint.json");
      await access(checkpointPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Abort the workflow
   */
  abort(): void {
    this.workflow.abort();
  }

  /**
   * Save checkpoint to disk (public method for shutdown handler)
   */
  async saveCheckpointToDisk(): Promise<void> {
    if (this.currentCheckpoint) {
      await this.saveCheckpointToFile(this.currentCheckpoint);
    }
  }

  /**
   * Save checkpoint to disk (private implementation)
   */
  private async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    this.currentCheckpoint = checkpoint;
    await this.saveCheckpointToFile(checkpoint);
  }

  /**
   * Save checkpoint to file
   */
  private async saveCheckpointToFile(checkpoint: Checkpoint): Promise<void> {
    const checkpointPath = join(this.checkpointDir, "checkpoint.json");
    await mkdir(this.checkpointDir, { recursive: true });
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Load checkpoint from disk
   */
  private async loadCheckpoint(): Promise<Checkpoint | null> {
    try {
      const checkpointPath = join(this.checkpointDir, "checkpoint.json");
      const data = await readFile(checkpointPath, "utf-8");
      return JSON.parse(data) as Checkpoint;
    } catch {
      return null;
    }
  }

  /**
   * Restore state from checkpoint
   */
  private restoreState(checkpoint: Checkpoint): void {
    this.currentCheckpoint = checkpoint;
    this.config.task = checkpoint.task;
    // Workflow state is restored when continue() is called
  }

  /**
   * Check if continue intent is present in message
   */
  private isContinueIntent(message: string): boolean {
    const phrases = [
      "continue",
      "keep going",
      "resume",
      "proceed",
      "finish",
      "complete",
      "go on",
      "next step",
      "what were we doing",
      "where were we",
      "status",
    ];
    return phrases.some(p => message.toLowerCase().includes(p));
  }

  /**
   * Create event stream for client
   */
  private createEventStream(): ReadableStream {
    return new ReadableStream({
      start: controller => {
        // Listen to all workflow events
        this.eventBus.on("AGENT_EVENT", event => {
          controller.enqueue(JSON.stringify(event) + "\n");
        });

        this.eventBus.on("PHASE_STARTED", event => {
          controller.enqueue(JSON.stringify({ type: "phase-start", phase: event.phase }) + "\n");
        });

        this.eventBus.on("PHASE_COMPLETED", event => {
          controller.enqueue(JSON.stringify({ type: "phase-complete", phase: event.phase }) + "\n");
        });

        this.eventBus.on("WORKFLOW_COMPLETED", () => {
          controller.close();
        });
      },
    });
  }

  /**
   * Prepend text to a stream
   */
  private prependToStream(text: string, stream: ReadableStream): ReadableStream {
    const reader = stream.getReader();
    let prepended = false;

    return new ReadableStream({
      async pull(controller) {
        if (!prepended) {
          controller.enqueue(text);
          prepended = true;
        }

        const { done, value } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
    });
  }
}
