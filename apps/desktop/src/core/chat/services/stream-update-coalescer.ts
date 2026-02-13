interface StreamUpdateCoalescerConfig<T> {
  frameMs?: number;
  getKey: (update: T) => string | undefined;
}

export interface StreamUpdateCoalescer<T> {
  enqueue: (update: T) => void;
  enqueueImmediate: (update: T) => void;
  flush: () => void;
  cancel: () => void;
  getPendingCount: () => number;
}

export function createStreamUpdateCoalescer<T>(
  applyUpdates: (updates: T[]) => void,
  config: StreamUpdateCoalescerConfig<T>
): StreamUpdateCoalescer<T> {
  const frameMs = config.frameMs ?? 16;
  const keyedUpdates = new Map<string, T>();
  const unkeyedUpdates: T[] = [];

  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }

    if (keyedUpdates.size === 0 && unkeyedUpdates.length === 0) return;

    const updates: T[] = [...keyedUpdates.values(), ...unkeyedUpdates];
    keyedUpdates.clear();
    unkeyedUpdates.length = 0;
    applyUpdates(updates);
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, frameMs);
  };

  const enqueue = (update: T) => {
    const key = config.getKey(update);
    if (key && key.length > 0) {
      keyedUpdates.set(key, update);
    } else {
      unkeyedUpdates.push(update);
    }
    scheduleFlush();
  };

  const enqueueImmediate = (update: T) => {
    flush();
    applyUpdates([update]);
  };

  const cancel = () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    keyedUpdates.clear();
    unkeyedUpdates.length = 0;
  };

  const getPendingCount = () => keyedUpdates.size + unkeyedUpdates.length;

  return {
    enqueue,
    enqueueImmediate,
    flush,
    cancel,
    getPendingCount,
  };
}
