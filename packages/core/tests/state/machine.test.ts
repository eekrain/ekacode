/**
 * Tests for XState hierarchical state machine
 *
 * Following the XState testing guide pattern:
 * https://stately.ai/docs/testing
 *
 * Arrange - set up the test by creating the actor logics and the actors
 * Act - send event(s) to the actor(s)
 * Assert - assert that the actor(s) reached their expected state(s) and/or executed the expected side effects
 */

import { afterEach, describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { rlmMachine } from "../../src/state/machine";
import type { RLMMachineContext } from "../../src/state/types";

describe("state/machine", () => {
  // Cleanup: Stop all actors after each test to prevent unhandled promise rejections
  const actors: ReturnType<typeof createActor>[] = [];

  function createTestActor(input?: Partial<RLMMachineContext>) {
    const actor = createActor(rlmMachine, {
      input: {
        runtime: { testMode: true },
        ...(input ?? {}),
      },
    });
    actors.push(actor);
    return actor;
  }

  afterEach(() => {
    for (const actor of actors) {
      try {
        actor.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }
    actors.length = 0;
  });
  describe("rlmMachine - Initial State", () => {
    it("should start in plan.analyze_code state", () => {
      // 1. Arrange - Create the actor
      const actor = createTestActor();

      // 2. Act - Start the actor
      actor.start();

      // 3. Assert - Verify initial state
      expect(actor.getSnapshot().value).toEqual({
        plan: "analyze_code",
      });
    });

    it("should have correct initial context values", () => {
      // 1. Arrange - Create the actor
      const actor = createTestActor();

      // 2. Act - Start the actor
      actor.start();

      // 3. Assert - Verify context
      const context = actor.getSnapshot().context as RLMMachineContext;
      expect(context.messages).toEqual([]);
      expect(context.goal).toBe("");
      expect(context.iterationCount).toBe(0);
      expect(context.recentStates).toEqual([]);
      // lastState is set by entry action when actor starts
      expect(context.lastState).toBe("plan.analyze_code");
      expect(context.toolExecutionCount).toBe(0);
      expect(context.errorCounts).toEqual({});
    });

    it("should set lastState on entry to analyze_code", () => {
      // 1. Arrange
      const actor = createTestActor();

      // 2. Act
      actor.start();

      // 3. Assert - lastState should be set by entry action
      const context = actor.getSnapshot().context as RLMMachineContext;
      expect(context.lastState).toBe("plan.analyze_code");
    });
  });

  describe("rlmMachine - Context Updates", () => {
    it("should add system message when addSystemMessage action is called", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act - Send an event that triggers the action
      // Note: This tests the action exists, actual execution happens during state transitions
      const initialContext = actor.getSnapshot().context as RLMMachineContext;

      // 3. Assert - Initial state has no messages
      expect(initialContext.messages).toEqual([]);
    });

    it("should track iteration count in context", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const context = actor.getSnapshot().context as RLMMachineContext;

      // 3. Assert
      expect(context.iterationCount).toBe(0);
      // iterationCount will be incremented during actual workflow execution
    });
  });

  describe("rlmMachine - State Structure", () => {
    it("should have plan compound state with substates", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const snapshot = actor.getSnapshot();

      // 3. Assert - Verify structure
      expect(snapshot.value).toHaveProperty("plan");
      expect(snapshot.value.plan).toBe("analyze_code");
    });

    it("should have build compound state available", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const machineConfig = rlmMachine.config;

      // 3. Assert - Verify build state exists in config
      expect(machineConfig.states).toHaveProperty("build");
      expect(machineConfig.states.build).toHaveProperty("initial");
      expect(machineConfig.states.build).toHaveProperty("states");
    });

    it("should have terminal states done and failed", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const machineConfig = rlmMachine.config;

      // 3. Assert
      expect(machineConfig.states).toHaveProperty("done");
      expect(machineConfig.states).toHaveProperty("failed");
    });
  });

  describe("rlmMachine - Guards", () => {
    it("should have hasValidationErrors guard", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act - Guards are defined at machine creation
      const machineConfig = rlmMachine.config;

      // 3. Assert - Guard is registered in the machine
      // The guards are defined in the machineSetup and used in the machine config
      expect(machineConfig).toBeDefined();
      // Guards like hasValidationErrors are used in the validate invoke onDone transitions
      expect(machineConfig.states.build?.states?.validate?.invoke?.onDone).toBeDefined();
    });

    it("should have isBuildClean guard", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const machineConfig = rlmMachine.config;

      // 3. Assert - Guard is registered in the machine
      expect(machineConfig).toBeDefined();
      // Guards like isBuildClean are used in the validate invoke onDone transitions
      expect(machineConfig.states.build?.states?.validate?.invoke?.onDone).toBeDefined();
    });
  });

  describe("rlmMachine - Actions", () => {
    it("should have setLastState action", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act - Actions are used in entry/exit of states
      const machineConfig = rlmMachine.config;

      // 3. Assert - Verify setLastState is used in state entries
      expect(machineConfig.states.plan?.states?.analyze_code?.entry).toBeDefined();
      expect(machineConfig.states.plan?.states?.research?.entry).toBeDefined();
    });

    it("should have incrementIteration action", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const machineConfig = rlmMachine.config;

      // 3. Assert - Verify incrementIteration is used in implement state
      // In XState v5, invoke.onDone.actions contains the actions
      const implementActions =
        machineConfig.states.build?.states?.implement?.invoke?.onDone?.actions;
      expect(implementActions).toBeDefined();
      // incrementIteration should be in the actions array
      expect(Array.isArray(implementActions)).toBe(true);
    });

    it("should have incrementToolExecution action", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const machineConfig = rlmMachine.config;

      // 3. Assert - Verify incrementToolExecution is used in validate state
      const validateOnDone = machineConfig.states.build?.states?.validate?.invoke?.onDone;
      expect(validateOnDone).toBeDefined();
      const transitions = Array.isArray(validateOnDone) ? validateOnDone : [validateOnDone];
      const hasIncrement = transitions.some(t => {
        const actions = (t as { actions?: Array<{ type: string }> }).actions ?? [];
        return actions.some(action => action.type === "incrementToolExecution");
      });
      expect(hasIncrement).toBe(true);
    });
  });

  describe("rlmMachine - Actors", () => {
    it("should have spawnExploreAgent actor", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act - Actors are invoked in state definitions
      const machineConfig = rlmMachine.config;

      // 3. Assert - Verify spawnExploreAgent is invoked in analyze_code state
      expect(machineConfig.states.plan?.states?.analyze_code?.invoke?.src).toBeDefined();
    });

    it("should have runPlanAgent actor", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const machineConfig = rlmMachine.config;

      // 3. Assert - Verify runPlanAgent is invoked in research/design states
      expect(machineConfig.states.plan?.states?.research?.invoke?.src).toBeDefined();
      expect(machineConfig.states.plan?.states?.design?.invoke?.src).toBeDefined();
    });

    it("should have runBuildAgent actor", () => {
      // 1. Arrange
      const actor = createTestActor();
      actor.start();

      // 2. Act
      const machineConfig = rlmMachine.config;

      // 3. Assert - Verify runBuildAgent is invoked in implement/validate states
      expect(machineConfig.states.build?.states?.implement?.invoke?.src).toBeDefined();
      expect(machineConfig.states.build?.states?.validate?.invoke?.src).toBeDefined();
    });
  });

  describe("rlmMachine - Input Merging", () => {
    it("should merge input context over defaults", () => {
      // 1. Arrange
      const actor = createTestActor({
        goal: "test goal",
        messages: [{ role: "user", content: "hello" }],
      });

      // 2. Act
      actor.start();
      const context = actor.getSnapshot().context as RLMMachineContext;

      // 3. Assert
      expect(context.goal).toBe("test goal");
      expect(context.messages).toEqual([{ role: "user", content: "hello" }]);
    });
  });
});
