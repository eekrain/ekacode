/**
 * T-023: UX integration tests for wizard flow
 *
 * End-to-end tests for conversational wizard workflow.
 */

import { clearWorkflowStore, upsertWorkflowState } from "@/state/stores/workflow-state-store";
import { createIntentAnalyzer } from "@sakti-code/core/chat/services/intent-analyzer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSpecWizardController, type WizardActionId } from "../spec-wizard-controller";

describe("Wizard UX Integration Tests (T-023)", () => {
  let controller: ReturnType<typeof createSpecWizardController>;
  let intentAnalyzer: ReturnType<typeof createIntentAnalyzer>;

  beforeEach(() => {
    clearWorkflowStore();
    controller = createSpecWizardController();
    intentAnalyzer = createIntentAnalyzer();
  });

  afterEach(() => {
    clearWorkflowStore();
  });

  describe("Intent -> Canonical Buttons -> Action ID Execution", () => {
    it("should render comprehensive/quick buttons on high-confidence feature request", async () => {
      // Arrange: Analyze intent for feature request
      const message = "I want to build a new feature for user authentication";
      const intentResult = intentAnalyzer.analyze(message);

      // Act: Check if wizard should be offered
      const shouldOffer = controller.shouldOfferWizard(intentResult, "session-001");

      // Assert: Should offer wizard for high-confidence feature request
      expect(intentResult.kind).toBe("feature_request");
      expect(intentResult.confidence).toBeGreaterThanOrEqual(0.7);
      expect(shouldOffer).toBe(true);

      // Act: Create workflow state and get buttons
      upsertWorkflowState({
        sessionId: "session-001",
        specSlug: "auth-feature",
        phase: "init",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      const buttons = await controller.getWizardButtons("session-001");

      // Assert: Should show comprehensive and quick options
      expect(buttons).toHaveLength(2);
      expect(buttons.find(b => b.action === "wizard:start:comprehensive")).toBeDefined();
      expect(buttons.find(b => b.action === "wizard:start:quick")).toBeDefined();
    });

    it("should not offer wizard on low-confidence feature request", () => {
      // Arrange: Analyze intent for ambiguous message
      const message = "hello world";
      const intentResult = intentAnalyzer.analyze(message);

      // Act & Assert: Should not offer wizard
      expect(intentResult.kind).toBe("other");
      expect(intentResult.confidence).toBeLessThan(0.7);
      expect(controller.shouldOfferWizard(intentResult, "session-001")).toBe(false);
    });

    it("should execute action ID when button is clicked", async () => {
      // Arrange: Create workflow state
      upsertWorkflowState({
        sessionId: "session-001",
        specSlug: "test-feature",
        phase: "init",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle comprehensive start action
      await controller.handleAction(
        "wizard:start:comprehensive" satisfies WizardActionId,
        "session-001"
      );

      // Assert: Workflow phase should advance to requirements
      const updatedState = controller.getWizardState("session-001");
      expect(updatedState?.phase).toBe("requirements");
      expect(updatedState?.specType).toBe("comprehensive");
    });
  });

  describe("Workflow Resume by Session", () => {
    it("should resume workflow from persisted state", async () => {
      // Arrange: Create initial workflow state
      upsertWorkflowState({
        sessionId: "session-resume-001",
        specSlug: "existing-feature",
        phase: "design",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now() - 1000, // 1 second ago
      });

      // Act: Get wizard buttons for resumed session
      const buttons = await controller.getWizardButtons("session-resume-001");

      // Assert: Should show design-phase buttons, not init buttons
      expect(buttons).toHaveLength(2);
      expect(buttons.find(b => b.action === "wizard:design:revise")).toBeDefined();
      expect(buttons.find(b => b.action === "wizard:design:approve")).toBeDefined();
      expect(buttons.find(b => b.action === "wizard:start:comprehensive")).toBeUndefined();
    });

    it("should show init buttons for new session without workflow state", async () => {
      // Act: Get wizard buttons for new session (no state exists)
      const buttons = await controller.getWizardButtons("new-session");

      // Assert: Should return empty array (no workflow state)
      expect(buttons).toHaveLength(0);

      // But wizard should be offered if intent is right
      const message = "Build a new feature";
      const intentResult = intentAnalyzer.analyze(message);
      expect(controller.shouldOfferWizard(intentResult, "new-session")).toBe(true);
    });
  });

  describe("Phase Transitions: Requirements Approve", () => {
    it("should transition to design when requirements are approved", async () => {
      // Arrange: Create workflow state in requirements phase
      upsertWorkflowState({
        sessionId: "session-phase-001",
        specSlug: "phase-test",
        phase: "requirements",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle requirements approve action
      await controller.handleAction(
        "wizard:requirements:approve" satisfies WizardActionId,
        "session-phase-001"
      );

      // Assert: Workflow phase should advance to design
      const updatedState = controller.getWizardState("session-phase-001");
      expect(updatedState?.phase).toBe("design");
    });

    it("should show design-phase buttons after requirements approval", async () => {
      // Arrange: Create workflow state in requirements phase and approve it
      upsertWorkflowState({
        sessionId: "session-phase-002",
        specSlug: "phase-test",
        phase: "requirements",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      await controller.handleAction(
        "wizard:requirements:approve" satisfies WizardActionId,
        "session-phase-002"
      );

      // Act: Get wizard buttons
      const buttons = await controller.getWizardButtons("session-phase-002");

      // Assert: Should show design-phase buttons
      expect(buttons).toHaveLength(2);
      expect(buttons.find(b => b.action === "wizard:design:revise")).toBeDefined();
      expect(buttons.find(b => b.action === "wizard:design:approve")).toBeDefined();
    });
  });

  describe("Phase Transitions: Design Approve", () => {
    it("should transition to tasks when design is approved", async () => {
      // Arrange: Create workflow state in design phase
      upsertWorkflowState({
        sessionId: "session-phase-003",
        specSlug: "phase-test",
        phase: "design",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle design approve action
      await controller.handleAction(
        "wizard:design:approve" satisfies WizardActionId,
        "session-phase-003"
      );

      // Assert: Workflow phase should advance to tasks
      const updatedState = controller.getWizardState("session-phase-003");
      expect(updatedState?.phase).toBe("tasks");
    });

    it("should show tasks-phase buttons after design approval", async () => {
      // Arrange: Create workflow state in design phase and approve it
      upsertWorkflowState({
        sessionId: "session-phase-004",
        specSlug: "phase-test",
        phase: "design",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      await controller.handleAction(
        "wizard:design:approve" satisfies WizardActionId,
        "session-phase-004"
      );

      // Act: Get wizard buttons
      const buttons = await controller.getWizardButtons("session-phase-004");

      // Assert: Should show tasks-phase buttons
      expect(buttons).toHaveLength(2);
      expect(buttons.find(b => b.action === "wizard:tasks:approve")).toBeDefined();
      expect(buttons.find(b => b.action === "spec-status")).toBeDefined();
    });
  });

  describe("Phase Transitions: Tasks Approve", () => {
    it("should transition to complete when tasks are approved", async () => {
      // Arrange: Create workflow state in tasks phase
      upsertWorkflowState({
        sessionId: "session-phase-005",
        specSlug: "phase-test",
        phase: "tasks",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle tasks approve action
      await controller.handleAction(
        "wizard:tasks:approve" satisfies WizardActionId,
        "session-phase-005"
      );

      // Assert: Workflow phase should advance to complete
      const updatedState = controller.getWizardState("session-phase-005");
      expect(updatedState?.phase).toBe("complete");
    });

    it("should show complete-phase buttons after tasks approval", async () => {
      // Arrange: Create workflow state in tasks phase and approve it
      upsertWorkflowState({
        sessionId: "session-phase-006",
        specSlug: "phase-test",
        phase: "tasks",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      await controller.handleAction(
        "wizard:tasks:approve" satisfies WizardActionId,
        "session-phase-006"
      );

      // Act: Get wizard buttons
      const buttons = await controller.getWizardButtons("session-phase-006");

      // Assert: Should show complete-phase buttons
      expect(buttons).toHaveLength(2);
      expect(buttons.find(b => b.action === "wizard:start-implementation")).toBeDefined();
      expect(buttons.find(b => b.action === "spec-status")).toBeDefined();
    });
  });

  describe("Quick Path Flow", () => {
    it("should skip requirements/design phases for quick spec", async () => {
      // Arrange: Create workflow state in init phase
      upsertWorkflowState({
        sessionId: "session-quick-001",
        specSlug: "quick-feature",
        phase: "init",
        specType: undefined,
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle quick start action
      await controller.handleAction(
        "wizard:start:quick" satisfies WizardActionId,
        "session-quick-001"
      );

      // Assert: Workflow phase should skip to tasks
      const updatedState = controller.getWizardState("session-quick-001");
      expect(updatedState?.phase).toBe("tasks");
      expect(updatedState?.specType).toBe("quick");
    });

    it("should allow approve tasks after quick start", async () => {
      // Arrange: Quick start workflow
      upsertWorkflowState({
        sessionId: "session-quick-002",
        specSlug: "quick-feature",
        phase: "tasks",
        specType: "quick",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle tasks approve action
      await controller.handleAction(
        "wizard:tasks:approve" satisfies WizardActionId,
        "session-quick-002"
      );

      // Assert: Should transition to complete
      const updatedState = controller.getWizardState("session-quick-002");
      expect(updatedState?.phase).toBe("complete");
    });
  });

  describe("Revise Actions", () => {
    it("should allow revise in requirements phase", async () => {
      // Arrange: Create workflow state in requirements phase
      upsertWorkflowState({
        sessionId: "session-revise-001",
        specSlug: "revise-test",
        phase: "requirements",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle revise action
      await controller.handleAction(
        "wizard:requirements:revise" satisfies WizardActionId,
        "session-revise-001"
      );

      // Assert: Phase should remain requirements
      const updatedState = controller.getWizardState("session-revise-001");
      expect(updatedState?.phase).toBe("requirements");
    });

    it("should allow revise in design phase", async () => {
      // Arrange: Create workflow state in design phase
      upsertWorkflowState({
        sessionId: "session-revise-002",
        specSlug: "revise-test",
        phase: "design",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Handle revise action
      await controller.handleAction(
        "wizard:design:revise" satisfies WizardActionId,
        "session-revise-002"
      );

      // Assert: Phase should remain design
      const updatedState = controller.getWizardState("session-revise-002");
      expect(updatedState?.phase).toBe("design");
    });
  });

  describe("Button Variants and Labels", () => {
    it("should use primary variant for main advance actions", async () => {
      // Arrange: Create workflow state in init phase
      upsertWorkflowState({
        sessionId: "session-variant-001",
        specSlug: "variant-test",
        phase: "init",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Get buttons
      const buttons = await controller.getWizardButtons("session-variant-001");

      // Assert: Comprehensive should be primary
      const comprehensiveButton = buttons.find(b => b.action === "wizard:start:comprehensive");
      expect(comprehensiveButton?.variant).toBe("primary");
    });

    it("should use secondary variant for optional actions", async () => {
      // Arrange: Create workflow state in init phase
      upsertWorkflowState({
        sessionId: "session-variant-002",
        specSlug: "variant-test",
        phase: "init",
        specType: "comprehensive",
        responses: [],
        updatedAt: Date.now(),
      });

      // Act: Get buttons
      const buttons = await controller.getWizardButtons("session-variant-002");

      // Assert: Quick should be secondary
      const quickButton = buttons.find(b => b.action === "wizard:start:quick");
      expect(quickButton?.variant).toBe("secondary");
    });

    it("should use correct labels for each phase", async () => {
      // Test labels for each phase
      const testCases = [
        { phase: "init" as const, labels: ["Comprehensive Spec", "Quick Spec"] },
        {
          phase: "requirements" as const,
          labels: ["Add More Requirements", "Approve Requirements and Continue"],
        },
        { phase: "design" as const, labels: ["Request Changes", "Approve Design and Continue"] },
        { phase: "tasks" as const, labels: ["Approve Tasks", "Edit Spec"] },
        { phase: "complete" as const, labels: ["Start Implementation", "Edit Spec"] },
      ];

      for (const testCase of testCases) {
        // Arrange: Create workflow state
        upsertWorkflowState({
          sessionId: `session-label-${testCase.phase}`,
          specSlug: "label-test",
          phase: testCase.phase,
          specType: "comprehensive",
          responses: [],
          updatedAt: Date.now(),
        });

        // Act: Get buttons
        const buttons = await controller.getWizardButtons(`session-label-${testCase.phase}`);

        // Assert: Labels should match expected
        const labels = buttons.map(b => b.label);
        expect(labels).toEqual(expect.arrayContaining(testCase.labels));
      }
    });
  });

  describe("Session Title Generation", () => {
    it("should generate title from first user message", () => {
      // Arrange
      const message = "Build a new authentication feature";

      // Act
      const title = controller.generateSessionTitle(message);

      // Assert
      expect(title).toBe("Build a new authentication feature");
    });

    it("should truncate long titles to 50 characters", () => {
      // Arrange
      const longMessage =
        "This is a very long message that should be truncated to exactly fifty characters and no more";

      // Act
      const title = controller.generateSessionTitle(longMessage);

      // Assert
      expect(title.length).toBeLessThanOrEqual(50);
      expect(title.endsWith("...")).toBe(true);
    });

    it("should handle empty messages", () => {
      // Act
      const title = controller.generateSessionTitle("");

      // Assert
      expect(title).toBe("Untitled Session");
    });

    it("should handle whitespace-only messages", () => {
      // Act
      const title = controller.generateSessionTitle("   ");

      // Assert
      expect(title).toBe("Untitled Session");
    });
  });
});
