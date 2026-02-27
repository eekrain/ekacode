import chokidar, { FSWatcher } from "chokidar";
import { fileIndex } from "./file-index";

export type FileEventCallback = (event: "add" | "change" | "unlink", path: string) => void;

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private callbacks: Set<FileEventCallback> = new Set();
  private readyPromises: Map<string, Promise<void>> = new Map();

  async watch(directory: string): Promise<void> {
    if (this.watchers.has(directory)) {
      await this.readyPromises.get(directory);
      return;
    }

    const watcher = chokidar.watch(directory, {
      ignored: [
        /(^|[\/\\])\../,
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/coverage/**",
        "**/.cache/**",
        "**/*.log",
      ],
      persistent: true,
      ignoreInitial: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    watcher.on("add", path => {
      fileIndex.add(directory, path, "file");
      this.notifyCallbacks("add", path);
    });

    watcher.on("addDir", path => {
      fileIndex.add(directory, path, "directory");
    });

    watcher.on("change", path => {
      fileIndex.remove(directory, path, "file");
      fileIndex.add(directory, path, "file");
      this.notifyCallbacks("change", path);
    });

    watcher.on("unlink", path => {
      fileIndex.remove(directory, path, "file");
      this.notifyCallbacks("unlink", path);
    });

    watcher.on("unlinkDir", path => {
      fileIndex.remove(directory, path, "directory");
    });

    const readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`File watcher readiness timeout for ${directory}`));
      }, 15000);

      watcher.once("ready", () => {
        clearTimeout(timeout);
        resolve();
      });

      watcher.once("error", error => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    this.watchers.set(directory, watcher);
    this.readyPromises.set(directory, readyPromise);

    try {
      await readyPromise;
    } catch (error) {
      this.watchers.delete(directory);
      this.readyPromises.delete(directory);
      await watcher.close();
      throw error;
    }
  }

  async unwatch(directory: string): Promise<void> {
    const watcher = this.watchers.get(directory);
    if (!watcher) return;

    await watcher.close();
    this.watchers.delete(directory);
    this.readyPromises.delete(directory);
    fileIndex.clear(directory);
  }

  isWatching(directory: string): boolean {
    return this.watchers.has(directory);
  }

  onFileEvent(callback: FileEventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(event: "add" | "change" | "unlink", path: string): void {
    this.callbacks.forEach(cb => cb(event, path));
  }

  async unwatchAll(): Promise<void> {
    await Promise.all(Array.from(this.watchers.keys()).map(dir => this.unwatch(dir)));
  }
}

export const fileWatcher = new FileWatcherService();
