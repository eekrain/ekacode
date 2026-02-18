import { describe, expect, it } from "vitest";
import { publish, subscribe, TaskUpdated } from "../../src/bus";

describe("TaskUpdated Event", () => {
  it("should publish and receive task updated event", async () => {
    const received: unknown[] = [];

    const unsubscribe = subscribe(TaskUpdated, event => {
      received.push(event.properties);
    });

    await publish(TaskUpdated, {
      sessionId: "session-123",
      tasks: [{ id: "task-1", title: "Test task", status: "open", priority: 2 }],
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      sessionId: "session-123",
      tasks: [{ id: "task-1", title: "Test task", status: "open", priority: 2 }],
    });

    unsubscribe();
  });
});
