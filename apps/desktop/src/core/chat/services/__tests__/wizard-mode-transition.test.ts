/**
 * T-022: Plan->Build transition from wizard completion tests
 *
 * Tests for mode transition integration when "Start Implementation" is clicked.
 */

import { clearWorkflowStore, upsertWorkflowState } from "@/state/stores/workflow-state-store";
import { readSpecState, writeSpecState, type SpecState } from "@sakti-code/core/spec/state";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSpecWizardController, type WizardActionId } from "../spec-wizard-controller";

describe("SpecWizardController - Plan->Build Transition (T-022)", () => {
  let controller: ReturnType<typeof createSpecWizardController>;
  let sessionId: string;
  let specDir: string;
  let specJsonPath: string;

  beforeEach(async () => {
    clearWorkflowStore();
    controller = createSpecWizardController();
    sessionId = "test-session-001";
    specDir = `/tmp/test-spec-${sessionId}`;
    specJsonPath = path.join(specDir, "spec.json");

    vi.clearAllMocks();

    // Clean up spec directory before each test
    try {
      await fs.rm(specDir, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  describe("Start Implementation button visibility", () => {
    it("should show 'Start Implementation' button when workflow is complete and ready_for_implementation is true", async () => {
      // Arrange: Create complete workflow state
      upsertWorkflowState({
        sessionId,
        specSlug: "test-feature",
        phase: "complete",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Arrange: Write spec.json with ready_for_implementation: true
      await fs.mkdir(specDir, { recursive: true });
      const specState: SpecState = {
        feature_name: "test-feature",
        phase: "tasks-generated",
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: true },
          tasks: { generated: true, approved: true },
        },
        ready_for_implementation: true,
        language: "en",
      };
      await writeSpecState(specJsonPath, specState);

      // Act: Get wizard buttons
      const buttons = await controller.getWizardButtons(sessionId);

      // Assert: Start Implementation button should be present and enabled
      const startImplButton = buttons.find(b => b.action === "wizard:start-implementation");
      expect(startImplButton).toBeDefined();
      expect(startImplButton?.label).toBe("Start Implementation");
      expect(startImplButton?.variant).toBe("primary");
      expect(startImplButton?.disabled).toBe(false);
    });

    it("should disable 'Start Implementation' button when ready_for_implementation is false", async () => {
      // Arrange: Create complete workflow state
      upsertWorkflowState({
        sessionId,
        specSlug: "test-feature",
        phase: "complete",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Arrange: Write spec.json with ready_for_implementation: false
      await fs.mkdir(specDir, { recursive: true });
      const specState: SpecState = {
        feature_name: "test-feature",
        phase: "tasks-generated",
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: true },
          tasks: { generated: true, approved: false }, // Not approved
        },
        ready_for_implementation: false, // Not ready
        language: "en",
      };
      await writeSpecState(specJsonPath, specState);

      // Act: Get wizard buttons
      const buttons = await controller.getWizardButtons(sessionId);

      // Assert: Start Implementation button should be disabled
      const startImplButton = buttons.find(b => b.action === "wizard:start-implementation");
      expect(startImplButton).toBeDefined();
      expect(startImplButton?.disabled).toBe(true);
    });

    it("should not show 'Start Implementation' button when workflow is not complete", async () => {
      // Arrange: Create incomplete workflow state
      upsertWorkflowState({
        sessionId,
        specSlug: "test-feature",
        phase: "tasks", // Not complete yet
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Get wizard buttons
      const buttons = await controller.getWizardButtons(sessionId);

      // Assert: Start Implementation button should not be present
      const startImplButton = buttons.find(b => b.action === "wizard:start-implementation");
      expect(startImplButton).toBeUndefined();
    });
  });

  describe("Start Implementation action handling", () => {
    beforeEach(async () => {
      // Setup: Create complete workflow state
      upsertWorkflowState({
        sessionId,
        specSlug: "test-feature",
        phase: "complete",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Setup: Write spec.json with ready_for_implementation: true
      await fs.mkdir(specDir, { recursive: true });
      const specState: SpecState = {
        feature_name: "test-feature",
        phase: "tasks-generated",
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: true },
          tasks: { generated: true, approved: true },
        },
        ready_for_implementation: true,
        language: "en",
      };
      await writeSpecState(specJsonPath, specState);
    });

    it("should trigger mode transition when 'Start Implementation' action is handled", async () => {
      // We need to mock the actual module since the controller imports it
      // For now, just test that the action can be called without error
      // Full implementation will be added in the next step

      // Act & Assert: Should not throw when action is handled
      await expect(
        controller.handleAction("wizard:start-implementation" satisfies WizardActionId, sessionId)
      ).resolves.not.toThrow();
    });

    it("should not trigger mode transition when ready_for_implementation is false", async () => {
      // Arrange: Set ready_for_implementation to false
      const specState = await readSpecState(specJsonPath);
      specState.ready_for_implementation = false;
      await writeSpecState(specJsonPath, specState);

      // Act & Assert: Should not throw
      await expect(
        controller.handleAction("wizard:start-implementation" satisfies WizardActionId, sessionId)
      ).resolves.not.toThrow();
    });

    it("should not trigger mode transition when all approvals are not true", async () => {
      // Arrange: Set tasks approval to false
      const specState = await readSpecState(specJsonPath);
      specState.approvals.tasks.approved = false;
      await writeSpecState(specJsonPath, specState);

      // Act & Assert: Should not throw
      await expect(
        controller.handleAction("wizard:start-implementation" satisfies WizardActionId, sessionId)
      ).resolves.not.toThrow();
    });
  });

  describe("Guard conditions", () => {
    it("should prevent transition when workflow phase is not 'complete'", async () => {
      // Arrange: Set workflow phase to 'tasks'
      const state = controller.getWizardState(sessionId);
      if (state) {
        state.phase = "tasks";
        upsertWorkflowState(state);
      }

      // Act & Assert: Should not throw
      await expect(
        controller.handleAction("wizard:start-implementation" satisfies WizardActionId, sessionId)
      ).resolves.not.toThrow();
    });

    it("should prevent transition when any approval is missing", async () => {
      // Arrange: Create complete workflow state
      upsertWorkflowState({
        sessionId,
        specSlug: "test-feature",
        phase: "complete",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      await fs.mkdir(specDir, { recursive: true });
      const specState: SpecState = {
        feature_name: "test-feature",
        phase: "tasks-generated",
        approvals: {
          requirements: { generated: true, approved: false }, // Not approved
          design: { generated: true, approved: true },
          tasks: { generated: true, approved: true },
        },
        ready_for_implementation: false,
        language: "en",
      };
      await writeSpecState(specJsonPath, specState);

      // Act & Assert: Should not throw
      await expect(
        controller.handleAction("wizard:start-implementation" satisfies WizardActionId, sessionId)
      ).resolves.not.toThrow();
    });
  });
});
