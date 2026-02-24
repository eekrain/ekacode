/**
 * Spec Wizard Controller Tests
 *
 * Tests for spec wizard orchestration and button rendering.
 */

import {
  createSpecWizardController,
  type SpecWizardController,
} from "@/core/chat/services/spec-wizard-controller";
import { clearWorkflowStore, upsertWorkflowState } from "@/state/stores/workflow-state-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("SpecWizardController", () => {
  let controller: SpecWizardController;

  beforeEach(() => {
    clearWorkflowStore();
    controller = createSpecWizardController();
  });

  afterEach(() => {
    clearWorkflowStore();
  });

  describe("shouldOfferWizard", () => {
    it("returns false for non-feature intent", () => {
      const result = {
        kind: "other",
        confidence: 0.5,
      };

      expect(controller.shouldOfferWizard(result, "session-123")).toBe(false);
    });

    it("returns false for low-confidence feature request", () => {
      const result = {
        kind: "feature_request",
        confidence: 0.6,
      };

      expect(controller.shouldOfferWizard(result, "session-123")).toBe(false);
    });

    it("returns true for high-confidence feature request", () => {
      const result = {
        kind: "feature_request",
        confidence: 0.8,
      };

      expect(controller.shouldOfferWizard(result, "session-123")).toBe(true);
    });
  });

  describe("getWizardButtons", () => {
    it("returns empty array for non-existent session", async () => {
      const buttons = await controller.getWizardButtons("non-existent");
      expect(buttons).toEqual([]);
    });

    it("returns init buttons for new session", async () => {
      upsertWorkflowState({
        sessionId: "new-session",
        specSlug: "new-feature",
        phase: "init",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });
      const buttons = await controller.getWizardButtons("new-session");
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toEqual({
        id: "start-comprehensive",
        label: "Comprehensive Spec",
        action: "wizard:start:comprehensive",
        variant: "primary",
      });
    });

    it("returns requirements buttons for requirements phase", async () => {
      upsertWorkflowState({
        sessionId: "requirements-session",
        specSlug: "requirements-feature",
        phase: "requirements",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });
      const buttons = await controller.getWizardButtons("requirements-session");
      expect(buttons).toHaveLength(2);

      const approveButton = buttons.find(b => b.action === "wizard:requirements:approve");
      expect(approveButton).toBeDefined();
    });
  });

  describe("generateSessionTitle", () => {
    it("generates title for normal input", () => {
      const title = controller.generateSessionTitle("Create a new feature for user authentication");
      expect(title).toBe("Create a new feature for user authentication");
    });

    it("truncates long input", () => {
      const longInput =
        "This is a very long title that should be truncated to fit within the maximum allowed length for a session title";
      const title = controller.generateSessionTitle(longInput);

      expect(title.length).toBeLessThanOrEqual(50);
      expect(title).toContain("...");
    });

    it("returns untitled for empty input", () => {
      const title = controller.generateSessionTitle("   ");
      expect(title).toBe("Untitled Session");
    });
  });

  describe("getPhase", () => {
    it("returns null for non-existent session", () => {
      const phase = controller.getPhase("non-existent");
      expect(phase).toBeNull();
    });
  });

  describe("getWizardState", () => {
    it("returns null for non-existent session", () => {
      const state = controller.getWizardState("non-existent");
      expect(state).toBeNull();
    });
  });
});
