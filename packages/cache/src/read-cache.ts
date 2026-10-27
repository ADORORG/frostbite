// A value with the moment it was read, so whoever shows it can say how old it is.
export interface Aged<Value> {
  readonly readAt: Date;
  readonly value: Value;
}

// How long a reading is trusted. Younger than `freshMs` it is served as it is. Between `freshMs` and `maxStaleMs` it is still served
// at once while one new reading is taken in the background, and kept if that fails. Older than `maxStaleMs` it is never served.
// `maxStaleMs` equal to `freshMs` is a plain time-to-live: nothing old is served.
export interface ReadPolicy {
  readonly freshMs: number;
  readonly maxStaleMs: number;
}

export interface ReadCache<Value> {
  // The reading for `key`, taking one with `ask` only when there is none the policy allows. Callers that arrive while a reading
  // is on its way share it; a reading that failed is never kept. Rejects only when there is nothing the policy allows to serve.
  read(key: string, ask: () => Promise<Value>): Promise<Aged<Value>>;
}

interface Held<Value> {
  readonly aged: Aged<Value>;
  readonly at: number;
}

interface Pending<Value> {
  readonly at: number;
  readonly promise: Promise<Held<Value>>;
}

export function assertReadPolicy(policy: ReadPolicy): void {
  const wholeMs = (value: number) => Number.isInteger(value) && value >= 0;
  if (
    !wholeMs(policy.freshMs) ||
    !wholeMs(policy.maxStaleMs) ||
    policy.maxStaleMs < policy.freshMs
  )
    throw new Error(
      "A read policy needs whole, non-negative milliseconds, with maxStaleMs not below freshMs.",
    );
}

export function createReadCache<Value>(options: {
  readonly now: () => Date;
  // Told which key a background refresh failed for (never why: the reason belongs to whoever asked), so a failure is not silent.
  readonly onRefreshFailed?: (key: string) => void;
  readonly policy: ReadPolicy;
}): ReadCache<Value> {
  const { now, onRefreshFailed, policy } = options;
  assertReadPolicy(policy);
  const held = new Map<string, Held<Value>>();
  const pending = new Map<string, Pending<Value>>();

  // One reading on its way per key. A reading still pending after `freshMs` is not waited on: a hung upstream must not hold back
  // every later caller, so the next one asks again.
  function refresh(
    key: string,
    ask: () => Promise<Value>,
  ): Promise<Held<Value>> {
    const startedAt = now();
    const at = startedAt.getTime();
    const running = pending.get(key);
    if (running !== undefined && at - running.at < policy.freshMs)
      return running.promise;
    const promise = (async (): Promise<Held<Value>> => {
      const next = {
        aged: { readAt: startedAt, value: await ask() },
        at,
      };
      // A reading that finishes late never replaces a newer one.
      if ((held.get(key)?.at ?? -Infinity) <= at) held.set(key, next);
      return next;
    })();
    const entry = { at, promise };
    pending.set(key, entry);
    const forget = () => {
      if (pending.get(key) === entry) pending.delete(key);
    };
    promise.then(forget, forget);
    return promise;
  }

  return {
    read: async (key, ask) => {
      const kept = held.get(key);
      const age = kept === undefined ? Infinity : now().getTime() - kept.at;
      if (kept !== undefined && age < policy.freshMs) return kept.aged;
      if (kept !== undefined && age < policy.maxStaleMs) {
        refresh(key, ask).catch(() => onRefreshFailed?.(key));
        return kept.aged;
      }
      return (await refresh(key, ask)).aged;
    },
  };
}
