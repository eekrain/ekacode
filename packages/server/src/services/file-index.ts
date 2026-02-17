import Minisearch from "minisearch";

export interface SearchResult {
  path: string;
  name: string;
  score: number;
  type: "file" | "directory";
}

const BLOCKLIST_PATTERNS = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  "*.log",
  ".env",
  ".env.local",
  ".env.*.local",
];

function matchesBlocklist(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");
  return BLOCKLIST_PATTERNS.some(pattern => {
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1);
      return normalizedPath.endsWith(ext);
    }
    return normalizedPath.includes(`/${pattern}/`) || normalizedPath.endsWith(`/${pattern}`);
  });
}

export class FileIndex {
  private indexes: Map<string, Minisearch> = new Map();
  private entries: Map<string, Map<string, IndexedEntry>> = new Map();

  add(directory: string, filePath: string, type: "file" | "directory" = "file"): void {
    if (matchesBlocklist(filePath)) return;

    const normalizedPath = filePath.replace(/\\/g, "/");
    const parts = normalizedPath.split("/");
    const name = parts[parts.length - 1] || "";
    const dir = parts.slice(0, -1).join("/") || "";
    const id = `${type}:${normalizedPath}`;
    const entry: IndexedEntry = {
      id,
      path: normalizedPath,
      name,
      directory: dir,
      type,
      depth: Math.max(parts.length - 1, 0),
    };

    const index = this.ensureIndex(directory);
    const directoryEntries = this.ensureEntries(directory);

    if (directoryEntries.has(id)) {
      index.discard(id);
    }

    directoryEntries.set(id, entry);
    index.add(entry);
  }

  remove(directory: string, filePath: string, type: "file" | "directory" = "file"): void {
    const index = this.indexes.get(directory);
    if (!index) return;

    const normalizedPath = filePath.replace(/\\/g, "/");
    const id = `${type}:${normalizedPath}`;
    index.discard(id);
    this.entries.get(directory)?.delete(id);
  }

  search(directory: string, query: string, limit = 20): SearchResult[] {
    const index = this.indexes.get(directory);
    const directoryEntries = this.entries.get(directory);
    if (!index || !directoryEntries) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const allEntries = Array.from(directoryEntries.values());

    if (!normalizedQuery) {
      return allEntries
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          if (a.depth !== b.depth) return a.depth - b.depth;
          return a.path.localeCompare(b.path);
        })
        .slice(0, limit)
        .map(entry => ({
          path: entry.path,
          name: entry.name,
          type: entry.type,
          score: 0,
        }));
    }

    const minisearchResults = index.search(query, {
      boost: { name: 6, path: 2, directory: 1 },
      fuzzy: 0.2,
      prefix: true,
    });
    const minisearchScoreById = new Map(
      minisearchResults.map(result => [String(result.id), result.score ?? 0])
    );

    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

    const rescored = allEntries
      .map(entry => {
        const baseScore = minisearchScoreById.get(entry.id) ?? 0;
        const lexicalScore = lexicalRelevanceScore(entry, normalizedQuery, queryTerms);
        const finalScore = baseScore + lexicalScore;
        return {
          path: entry.path,
          name: entry.name,
          type: entry.type,
          score: finalScore,
        };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.path.localeCompare(b.path);
      });

    return rescored.slice(0, limit);
  }

  clear(directory: string): void {
    this.indexes.delete(directory);
    this.entries.delete(directory);
  }

  hasIndex(directory: string): boolean {
    return this.indexes.has(directory);
  }

  private ensureIndex(directory: string): Minisearch {
    let index = this.indexes.get(directory);
    if (!index) {
      index = new Minisearch({
        fields: ["name", "path", "directory", "type"],
        storeFields: ["path", "name", "directory", "type"],
        searchOptions: {
          boost: { name: 6, path: 2, directory: 1 },
          fuzzy: 0.2,
          prefix: true,
        },
      });
      this.indexes.set(directory, index);
    }
    return index;
  }

  private ensureEntries(directory: string): Map<string, IndexedEntry> {
    let directoryEntries = this.entries.get(directory);
    if (!directoryEntries) {
      directoryEntries = new Map();
      this.entries.set(directory, directoryEntries);
    }
    return directoryEntries;
  }
}

export const fileIndex = new FileIndex();

interface IndexedEntry {
  id: string;
  path: string;
  name: string;
  directory: string;
  type: "file" | "directory";
  depth: number;
}

function lexicalRelevanceScore(
  entry: IndexedEntry,
  normalizedQuery: string,
  queryTerms: string[]
): number {
  const name = entry.name.toLowerCase();
  const path = entry.path.toLowerCase();

  let score = 0;
  if (name === normalizedQuery) score += 140;
  if (name.startsWith(normalizedQuery)) score += 90;
  if (name.includes(normalizedQuery)) score += 60;
  if (path.startsWith(normalizedQuery)) score += 45;
  if (path.includes(`/${normalizedQuery}`)) score += 35;
  if (path.includes(normalizedQuery)) score += 20;

  if (queryTerms.length > 1) {
    const matchedTerms = queryTerms.filter(term => path.includes(term)).length;
    if (matchedTerms === queryTerms.length) {
      score += 20 + matchedTerms * 8;
    } else if (matchedTerms > 0) {
      score += matchedTerms * 4;
    }
  }

  if (entry.type === "directory") {
    score += 6;
  }

  score += Math.max(0, 10 - entry.depth);
  return score;
}
