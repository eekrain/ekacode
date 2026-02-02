/**
 * Tests for session controller
 *
 * These tests validate the session controller that manages
 * workflow execution and user message processing.
 */

import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionController } from "../../src/session/controller";
import { SessionConfig } from "../../src/session/types";

// Mock the workflow engine
vi.mock("../../src/workflow/engine", () => ({
  WorkflowEngine: class MockWorkflowEngine {
    sessionId: string;
    task = "";
    phase: SessionPhase = "idle";

    constructor(sessionId: string, _eventBus: EventEmitter, _checkpointSaver: unknown) {
      this.sessionId = sessionId;
    }

    async start(task: string): Promise<void> {
      this.task = task;
      this.phase = "completed";
    }

    async resumeFromCheckpoint(_checkpoint: Checkpoint): Promise<void> {
      this.phase = "completed";
    }

    getStatus() {
      return {
        sessionId: this.sessionId,
        phase: this.phase,
        progress: 0,
        hasIncompleteWork: false,
        summary: "Test",
        lastActivity: Date.now(),
        activeAgents: [],
      };
    }

    abort(): void {
      // Mock
    }
  },
}));

// Mock fs operations
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(JSON.stringify({})),
}));

describe("session/controller", () => {
  let _mockEventBus: EventEmitter;
  let mockCheckpointDir: string;
  let mockConfig: SessionConfig;

  beforeEach(() => {
    _mockEventBus = new EventEmitter();
    mockCheckpointDir = "/tmp/test-checkpoints";
    mockConfig = {
      resourceId: "local",
      task: "Test task",
      workspace: "/test/workspace",
    };
  });

  describe("constructor", () => {
    it("should create controller with session ID", () => {
      const controller = new SessionController({
        sessionId: "test-session",
        sessionConfig: mockConfig,
        checkpointDir: mockCheckpointDir,
      });

      expect(controller).toBeDefined();
      expect(controller.sessionId).toBe("test-session");
    });

    it("should start in idle phase", () => {
      const controller = new SessionController({
        sessionId: "test-session",
        sessionConfig: mockConfig,
        checkpointDir: mockCheckpointDir,
      });

      expect(controller.getStatus().phase).toBe("idle");
    });
  });

  describe("start", () => {
    it("should start workflow with task", async () => {
      const controller = new SessionController({
        sessionId: "test-session",
        sessionConfig: mockConfig,
        checkpointDir: mockCheckpointDir,
      });

      await controller.start("Test task");

      expect(controller.getStatus().phase).toBe("completed");
    });
  });

  describe("getStatus", () => {
    it("should return session status", () => {
      const controller = new SessionController({
        sessionId: "test-session",
        sessionConfig: mockConfig,
        checkpointDir: mockCheckpointDir,
      });

      const status = controller.getStatus();

      expect(status).toBeDefined();
      expect(status.sessionId).toBe("test-session");
      expect(status.phase).toBe("idle");
    });
  });

  describe("hasIncompleteWork", () => {
    it("should return false for idle phase", () => {
      const controller = new SessionController({
        sessionId: "test-session",
        sessionConfig: mockConfig,
        checkpointDir: mockCheckpointDir,
      });

      expect(controller.hasIncompleteWork()).toBe(false);
    });
  });

  describe("abort", () => {
    it("should have abort method", () => {
      const controller = new SessionController({
        sessionId: "test-session",
        sessionConfig: mockConfig,
        checkpointDir: mockCheckpointDir,
      });

      expect(() => controller.abort()).not.toThrow();
    });
  });
});
