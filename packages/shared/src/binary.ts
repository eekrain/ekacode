/**
 * Binary Search Utility
 *
 * Efficient binary search implementation for sorted arrays.
 * Based on @opencode-ai/util/binary pattern.
 *
 * @template T - Array element type
 * @param K - Key type for comparison
 */

export interface BinarySearchResult<T> {
  /** Whether the key was found */
  found: boolean;
  /** The index where the key was found or where it should be inserted */
  index: number;
  /** The found element (if found) */
  item?: T;
}

/**
 * Compare two values
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
type CompareFn<K> = (a: K, b: K) => number;

/**
 * Default string compare function
 */
const stringCompare: CompareFn<string> = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * Binary search in a sorted array
 *
 * @param array - Sorted array to search
 * @param key - Key to search for
 * @param keyFn - Function to extract key from array element
 * @param compare - Optional compare function (defaults to string compare)
 * @returns Search result with found status and index
 *
 * @example
 * const messages = [{ id: "a" }, { id: "b" }, { id: "c" }];
 * const result = Binary.search(messages, "b", (m) => m.id);
 * if (result.found) {
 *   console.log(result.item); // { id: "b" }
 * }
 */
export function Binary<T, K = string>(
  array: T[],
  key: K,
  keyFn: (item: T) => K,
  compare: CompareFn<K> = stringCompare as CompareFn<K>
): BinarySearchResult<T> {
  let left = 0;
  let right = array.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midKey = keyFn(array[mid]);
    const cmp = compare(midKey, key);

    if (cmp === 0) {
      return {
        found: true,
        index: mid,
        item: array[mid],
      };
    } else if (cmp < 0) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return {
    found: false,
    index: left,
  };
}

/**
 * Insert an item into a sorted array at the correct position
 *
 * @param array - Sorted array
 * @param item - Item to insert
 * @param keyFn - Function to extract key
 * @returns The index where the item was inserted
 */
export function BinaryInsert<T, K = string>(array: T[], item: T, keyFn: (item: T) => K): number {
  const key = keyFn(item);
  const result = Binary(array, key, keyFn);
  array.splice(result.index, 0, item);
  return result.index;
}

/**
 * Remove an item from a sorted array by key
 *
 * @param array - Sorted array
 * @param key - Key to remove
 * @param keyFn - Function to extract key
 * @returns Whether the item was found and removed
 */
export function BinaryRemove<T, K = string>(array: T[], key: K, keyFn: (item: T) => K): boolean {
  const result = Binary(array, key, keyFn);
  if (result.found) {
    array.splice(result.index, 1);
    return true;
  }
  return false;
}

/**
 * Find the index for inserting to maintain sorted order
 *
 * @param array - Sorted array
 * @param key - Key to find insertion point for
 * @param keyFn - Function to extract key
 * @returns The index where the key should be inserted
 */
export function BinaryInsertIndex<T, K = string>(
  array: T[],
  key: K,
  keyFn: (item: T) => K
): number {
  return Binary(array, key, keyFn).index;
}

/**
 * Utility for binary search on arrays of primitive strings
 */
export function binarySearchString(array: string[], key: string): BinarySearchResult<string> {
  return Binary(array, key, s => s);
}

/**
 * Utility for binary search on arrays with numeric IDs
 */
export function binarySearchNumber<T>(
  array: T[],
  key: number,
  keyFn: (item: T) => number
): BinarySearchResult<T> {
  return Binary(array, key, keyFn, (a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}
