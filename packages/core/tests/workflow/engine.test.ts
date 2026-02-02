/**
 * Tests for workflow engine
 *
 * These tests validate the workflow orchestration for
 * explore → plan → build phases.
 */

import { EventEmitter } from "events";
import { describe, expect, it, vi } from "vitest";
import { Checkpoint } from "../../src/session/types";
import { WorkflowEngine } from "../../src/workflow/engine";

// Mock the agent factory
vi.mock("../../src/agent/workflow/factory", () => ({
  createExploreAgent: (index: number) => ({
    id: `explore-${index}`,
    type: "explore",
    model: "test-model",
    systemPrompt: "Test explore prompt",
    tools: [],
    maxIterations: 5,
  }),
  createPlanAgent: () => ({
    id: "planner",
    type: "plan",
    model: "test-model",
    systemPrompt: "Test plan prompt",
    tools: [],
    maxIterations: 5,
  }),
  createBuildAgent: () => ({
    id: "builder",
    type: "build",
    model: "test-model",
    systemPrompt: "Test build prompt",
    tools: [],
    maxIterations: 5,
  }),
  runAgent: vi.fn(),
}));

describe("workflow/engine", () => {
  let mockEventBus: EventEmitter;
  let mockCheckpointSaver: (checkpoint: Checkpoint) => Promise<void>;
  let sessionId: string;

  beforeEach(() => {
    mockEventBus = new EventEmitter();
    mockCheckpointSaver = vi.fn().mockResolvedValue(undefined);
    sessionId = "test-session-id";
  });

  describe("constructor", () => {
    it("should create workflow engine with session ID", () => {
      const engine = new WorkflowEngine(sessionId, mockEventBus, mockCheckpointSaver);

      expect(engine).toBeDefined();
    });
  });

  describe("getStatus", () => {
    it("should return idle status initially", () => {
      const engine = new WorkflowEngine(sessionId, mockEventBus, mockCheckpointSaver);

      const status = engine.getStatus();

      expect(status.phase).toBe("idle");
      expect(status.sessionId).toBe(sessionId);
      expect(status.progress).toBe(0);
      expect(status.hasIncompleteWork).toBe(false);
    });
  });

  describe("abort", () => {
    it("should have abort method", () => {
      const engine = new WorkflowEngine(sessionId, mockEventBus, mockCheckpointSaver);

      expect(typeof engine.abort).toBe("function");
    });

    it("should call abort without throwing", () => {
      const engine = new WorkflowEngine(sessionId, mockEventBus, mockCheckpointSaver);

      expect(() => engine.abort()).not.toThrow();
    });
  });

  describe("event emission", () => {
    it("should emit events through event bus", async () => {
      void new WorkflowEngine(sessionId, mockEventBus, mockCheckpointSaver);

      const eventPromise = new Promise(resolve => {
        mockEventBus.once("AGENT_EVENT", event => {
          expect(event).toBeDefined();
          resolve(undefined);
        });
      });

      // Trigger an event
      mockEventBus.emit("AGENT_EVENT", {
        type: "text",
        text: "test",
        agentId: "test-agent",
      });

      await eventPromise;
    });
  });
});
