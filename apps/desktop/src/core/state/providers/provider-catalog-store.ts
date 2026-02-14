import type { ProviderCatalogItem } from "@/core/services/api/provider-client";
import MiniSearch from "minisearch";

export interface ProviderCatalogGroup {
  key: string;
  title: string;
  providers: ProviderCatalogItem[];
}

interface ProviderCatalogDoc {
  id: string;
  name: string;
  aliases: string;
  searchable: string;
}

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function toLoose(input: string): string {
  return normalize(input)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandTerms(query: string): string[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const terms = new Set<string>([normalized, toLoose(normalized)]);
  if (normalized.includes("z.ai")) terms.add(normalized.replaceAll("z.ai", "zai"));
  if (normalized.includes("z ai")) terms.add(normalized.replaceAll("z ai", "zai"));
  if (normalized.includes("kimi")) terms.add(normalized.replaceAll("kimi", "moonshot"));
  return Array.from(terms);
}

function scoreProvider(provider: ProviderCatalogItem, query: string): number {
  const normalized = normalize(query);
  if (!normalized) return 0;

  const id = provider.id.toLowerCase();
  const name = provider.name.toLowerCase();
  const aliases = provider.aliases.map(alias => alias.toLowerCase());
  const looseQuery = toLoose(normalized);

  let score = 0;
  if (id === normalized) score += 1200;
  if (name === normalized) score += 1000;
  if (aliases.includes(normalized)) score += 980;

  if (id.startsWith(normalized)) score += 520;
  if (name.startsWith(normalized)) score += 460;
  if (aliases.some(alias => alias.startsWith(normalized))) score += 430;

  if (id.includes(normalized)) score += 240;
  if (name.includes(normalized)) score += 220;
  if (aliases.some(alias => alias.includes(normalized))) score += 210;
  if (aliases.some(alias => toLoose(alias).includes(looseQuery))) score += 180;

  if (provider.connected) score += 25;
  if (provider.popular) score += 20;

  return score;
}

function sortProviders(a: ProviderCatalogItem, b: ProviderCatalogItem, query: string): number {
  const scoreDelta = scoreProvider(b, query) - scoreProvider(a, query);
  if (scoreDelta !== 0) return scoreDelta;
  if (a.connected !== b.connected) return a.connected ? -1 : 1;
  if (a.popular !== b.popular) return a.popular ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export function createProviderCatalogSearchIndex(items: ProviderCatalogItem[]) {
  const providersById = new Map(items.map(provider => [provider.id, provider] as const));
  const docs: ProviderCatalogDoc[] = items.map(provider => ({
    id: provider.id,
    name: provider.name,
    aliases: provider.aliases.join(" "),
    searchable: `${provider.id} ${provider.name} ${provider.aliases.join(" ")} ${provider.note ?? ""}`,
  }));

  const index = new MiniSearch<ProviderCatalogDoc>({
    idField: "id",
    fields: ["name", "id", "aliases", "searchable"],
    storeFields: ["id"],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: {
        name: 2,
        aliases: 2,
        id: 1.75,
      },
    },
  });
  index.addAll(docs);

  const searchCache = new Map<string, ProviderCatalogItem[]>();

  const search = (query: string): ProviderCatalogItem[] => {
    const normalized = normalize(query);
    const cached = searchCache.get(normalized);
    if (cached) return cached;

    if (!normalized) {
      const ordered = [...items].sort((a, b) => sortProviders(a, b, ""));
      searchCache.set(normalized, ordered);
      return ordered;
    }

    const ids = new Set<string>();
    const terms = expandTerms(normalized);

    for (const provider of items) {
      const text = toLoose(`${provider.id} ${provider.name} ${provider.aliases.join(" ")}`);
      if (terms.some(term => text.includes(toLoose(term)))) {
        ids.add(provider.id);
      }
    }

    for (const term of terms) {
      const exact = index.search(term, { prefix: true, fuzzy: false });
      for (const hit of exact) ids.add(String(hit.id));
    }

    if (ids.size === 0) {
      for (const term of terms) {
        if (term.length < 3) continue;
        const fuzzy = index.search(term, { prefix: true, fuzzy: 0.2 });
        for (const hit of fuzzy) ids.add(String(hit.id));
      }
    }

    const results = Array.from(ids)
      .map(id => providersById.get(id))
      .filter((value): value is ProviderCatalogItem => Boolean(value))
      .sort((a, b) => sortProviders(a, b, normalized));
    searchCache.set(normalized, results);
    return results;
  };

  const groups = (query: string): ProviderCatalogGroup[] => {
    const results = search(query);
    if (results.length === 0) return [];

    const popular = results.filter(provider => provider.popular);
    const rest = results.filter(provider => !provider.popular);

    if (popular.length === 0 || rest.length === 0) {
      return [{ key: "all", title: "All Providers", providers: results }];
    }

    return [
      { key: "popular", title: "Popular", providers: popular },
      { key: "all", title: "All Providers", providers: rest },
    ];
  };

  return { search, groups };
}
