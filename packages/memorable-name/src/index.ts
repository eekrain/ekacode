import { adjectives, nouns } from "./words.js";

export interface Options {
  words?: number;
  number?: boolean;
  alliterative?: boolean;
}

export interface Result {
  dashed: string;
  raw: (string | number)[];
  spaced: string;
}

export function generate(options?: Options): Result {
  return generateName(options);
}

export function generateMany(count: number, options?: Options): Result[] {
  const results: Result[] = [];
  const seen = new Set<string>();

  while (results.length < count) {
    const result = generateName(options);
    if (!seen.has(result.dashed)) {
      seen.add(result.dashed);
      results.push(result);
    }
  }

  return results;
}

function generateName(options?: Options): Result {
  const opts = {
    words: 2,
    number: false,
    alliterative: false,
    ...options,
  };

  const raw: (string | number)[] = [];

  for (let i = 0; i < opts.words - 1; i++) {
    if (opts.alliterative && raw.length > 0) {
      raw.push(sample(getAlliterativeMatches(adjectives, String(raw[0]).substring(0, 1))));
    } else {
      raw.push(sample(adjectives).toLowerCase());
    }
  }

  if (opts.alliterative && raw.length > 0) {
    raw.push(sample(getAlliterativeMatches(nouns, String(raw[0]).substring(0, 1))));
  } else {
    raw.push(sample(nouns).toLowerCase());
  }

  if (opts.number) {
    raw.push(Math.floor(Math.random() * 9999) + 1);
  }

  return {
    raw,
    dashed: raw.join("-"),
    spaced: raw.join(" "),
  };
}

function sample<T>(arr: readonly T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  const item = arr[index];
  if (item === undefined) {
    throw new Error("Array is empty");
  }
  return item;
}

function getAlliterativeMatches(arr: readonly string[], letter: string): string[] {
  const check = letter.toLowerCase();
  return arr.filter(elm => elm.substring(0, 1).toLowerCase() === check);
}
