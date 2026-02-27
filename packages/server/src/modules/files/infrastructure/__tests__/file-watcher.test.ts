import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileWatcherService } from "../file-watcher";

describe("FileWatcherService", () => {
  let watcher: FileWatcherService;

  beforeEach(() => {
    watcher = new FileWatcherService();
  });

  afterEach(async () => {
    await watcher.unwatchAll();
  });

  it("should initialize watcher for a directory", async () => {
    await watcher.watch("/tmp/test-project");
    expect(watcher.isWatching("/tmp/test-project")).toBe(true);
  });

  it("should stop watching a directory", async () => {
    await watcher.watch("/tmp/test-project");
    await watcher.unwatch("/tmp/test-project");
    expect(watcher.isWatching("/tmp/test-project")).toBe(false);
  });
});
