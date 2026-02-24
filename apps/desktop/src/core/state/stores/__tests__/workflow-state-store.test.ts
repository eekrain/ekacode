/**
 * Workflow State Store Tests
 *
 * Tests for workflow state persistence and retrieval.
 */

import {
  clearWorkflowStore,
  getWorkflowState,
  upsertWorkflowState,
  type SpecWorkflowState,
} from "@/state/stores/workflow-state-store";
import { afterEach, describe, expect, it } from "vitest";

describe("WorkflowStateStore", () => {
  afterEach(() => {
    clearWorkflowStore();
  });

  describe("upsertWorkflowState", () => {
    it("creates new state for session", () => {
      const state: SpecWorkflowState = {
        sessionId: "session-123",
        phase: "init",
        updatedAt: Date.now(),
        responses: [],
      };

      upsertWorkflowState(state);

      const retrieved = getWorkflowState("session-123");
      expect(retrieved).toEqual(state);
    });

    it("updates existing state for session", () => {
      const state1: SpecWorkflowState = {
        sessionId: "session-456",
        phase: "init",
        specSlug: "test-spec",
        specType: "comprehensive",
        updatedAt: Date.now(),
        responses: [],
      };

      upsertWorkflowState(state1);

      const state2: SpecWorkflowState = {
        sessionId: "session-456",
        phase: "requirements",
        specSlug: "test-spec",
        specType: "comprehensive",
        updatedAt: Date.now() + 1000,
        responses: [],
      };

      upsertWorkflowState(state2);

      const retrieved = getWorkflowState("session-456");
      expect(retrieved).toEqual(state2);
    });

    it("persists responses array", () => {
      const state: SpecWorkflowState = {
        sessionId: "session-789",
        phase: "requirements",
        responses: [
          { phase: "init", payload: { action: "start" } },
          { phase: "requirements", payload: { question: "more-info" } },
        ],
        updatedAt: Date.now(),
      };

      upsertWorkflowState(state);

      const retrieved = getWorkflowState("session-789");
      expect(retrieved?.responses).toHaveLength(2);
      expect(retrieved?.responses[0]).toEqual({ phase: "init", payload: { action: "start" } });
    });
  });

  describe("getWorkflowState", () => {
    it("returns null for non-existent session", () => {
      const state = getWorkflowState("non-existent");
      expect(state).toBeNull();
    });

    it("returns state for existing session", () => {
      const state: SpecWorkflowState = {
        sessionId: "session-existing",
        phase: "design",
        specSlug: "existing-spec",
        specType: "quick",
        updatedAt: Date.now(),
        responses: [],
      };

      upsertWorkflowState(state);

      const retrieved = getWorkflowState("session-existing");
      expect(retrieved).toEqual(state);
    });
  });

  describe("clearWorkflowStore", () => {
    it("removes all stored states", () => {
      const state: SpecWorkflowState = {
        sessionId: "session-to-clear",
        phase: "tasks",
        updatedAt: Date.now(),
        responses: [],
      };

      upsertWorkflowState(state);

      expect(getWorkflowState("session-to-clear")).not.toBeNull();

      clearWorkflowStore();

      expect(getWorkflowState("session-to-clear")).toBeNull();
    });
  });

  describe("phase transitions", () => {
    it("tracks phase changes", () => {
      const initialState: SpecWorkflowState = {
        sessionId: "session-phase",
        phase: "init",
        updatedAt: 1000,
        responses: [],
      };

      upsertWorkflowState(initialState);

      const designState: SpecWorkflowState = {
        sessionId: "session-phase",
        phase: "design",
        updatedAt: 2000,
        responses: [],
      };

      upsertWorkflowState(designState);

      const retrieved = getWorkflowState("session-phase");
      expect(retrieved?.phase).toBe("design");
      expect(retrieved?.updatedAt).toBe(2000);
    });
  });

  describe("spec type tracking", () => {
    it("stores comprehensive spec type", () => {
      const state: SpecWorkflowState = {
        sessionId: "session-type",
        phase: "init",
        specType: "comprehensive",
        updatedAt: Date.now(),
        responses: [],
      };

      upsertWorkflowState(state);

      const retrieved = getWorkflowState("session-type");
      expect(retrieved?.specType).toBe("comprehensive");
    });

    it("stores quick spec type", () => {
      const state: SpecWorkflowState = {
        sessionId: "session-type",
        phase: "init",
        specType: "quick",
        updatedAt: Date.now(),
        responses: [],
      };

      upsertWorkflowState(state);

      const retrieved = getWorkflowState("session-type");
      expect(retrieved?.specType).toBe("quick");
    });

    it("allows undefined spec type", () => {
      const state: SpecWorkflowState = {
        sessionId: "session-type",
        phase: "init",
        updatedAt: Date.now(),
        responses: [],
      };

      upsertWorkflowState(state);

      const retrieved = getWorkflowState("session-type");
      expect(retrieved?.specType).toBeUndefined();
    });
  });
});
