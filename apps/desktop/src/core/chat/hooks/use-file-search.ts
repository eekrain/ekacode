import { createApiClient } from "@/core/services/api/api-client";
import { createSignal, type Accessor } from "solid-js";

export interface FileSearchResult {
  path: string;
  name: string;
  score: number;
  type: "file" | "directory";
}

export function useFileSearch(workspace: Accessor<string>) {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<FileSearchResult[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);

  const search = async (searchQuery: string) => {
    const dir = workspace();
    if (!dir) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const client = await createApiClient();
      const response = await client.searchFiles({
        directory: dir,
        query: searchQuery,
        limit: 20,
      });
      setResults(response.files);
    } catch (error) {
      console.error("File search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    query,
    setQuery,
    results,
    isLoading,
    search,
  };
}
