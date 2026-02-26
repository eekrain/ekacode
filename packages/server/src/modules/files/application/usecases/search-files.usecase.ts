import { fileIndex, type SearchResult } from "@/services/file-index.js";
import { fileWatcher } from "@/services/file-watcher.js";

export interface SearchFilesInput {
  directory: string;
  query?: string;
  limit?: number;
}

export interface SearchFilesOutput {
  files: SearchResult[];
  query: string;
  directory: string;
  count: number;
}

export async function searchFiles(input: SearchFilesInput): Promise<SearchFilesOutput> {
  const { directory, query = "", limit = 20 } = input;

  if (!fileIndex.hasIndex(directory)) {
    await fileWatcher.watch(directory);
  }

  const results = fileIndex.search(directory, query, limit);

  return {
    files: results,
    query,
    directory,
    count: results.length,
  };
}

export interface FileStatusOutput {
  directory: string;
  watching: boolean;
  indexed: boolean;
}

export function getFileStatus(directory: string): FileStatusOutput {
  return {
    directory,
    watching: fileWatcher.isWatching(directory),
    indexed: fileIndex.hasIndex(directory),
  };
}

export interface WatchDirectoryInput {
  directory: string;
}

export interface WatchDirectoryOutput {
  success: boolean;
  directory: string;
  message: string;
}

export async function watchDirectory(input: WatchDirectoryInput): Promise<WatchDirectoryOutput> {
  await fileWatcher.watch(input.directory);
  return {
    success: true,
    directory: input.directory,
    message: "Now watching for file changes",
  };
}

export interface UnwatchDirectoryInput {
  directory: string;
}

export interface UnwatchDirectoryOutput {
  success: boolean;
  directory: string;
  message: string;
}

export async function unwatchDirectory(
  input: UnwatchDirectoryInput
): Promise<UnwatchDirectoryOutput> {
  await fileWatcher.unwatch(input.directory);
  return {
    success: true,
    directory: input.directory,
    message: "Stopped watching",
  };
}
