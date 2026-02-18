import { describe, expect, it } from "vitest";
import type { Task } from "../src/core/chat/types/task";

describe("Task Types", () => {
  it("should have correct shape for Task", () => {
    const task: Task = {
      id: "task-123",
      title: "Test task",
      status: "open",
      priority: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(task.id).toBe("task-123");
    expect(task.status).toBe("open");
  });
});
