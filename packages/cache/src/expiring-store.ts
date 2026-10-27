import { z } from "zod";

import type { Aged } from "./read-cache.ts";

// The part of the browser's storage the store needs, so a test (or a browser that refuses storage) can stand in for it.
export interface KeyValueStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface ExpiringStore<Value> {
  remove(key: string): void;
  // The stored reading, or null when there is none, it is older than `maxAgeMs`, or it is not a `Value`.
  read(key: string): Aged<Value> | null;
  write(key: string, reading: Aged<Value>): void;
}

// Readings kept in browser storage for a short time, shared by every tab of the site. Storage is advisory: it can be missing, full,
// blocked or edited by the person, so a failure to read or write is a miss, and what is read is checked against `schema` before it is
// trusted.
export function createExpiringStore<Value>(options: {
  readonly maxAgeMs: number;
  readonly now: () => Date;
  readonly prefix: string;
  readonly schema: z.ZodType<Value>;
  readonly storage: KeyValueStorage | null;
}): ExpiringStore<Value> {
  const { maxAgeMs, now, prefix, schema, storage } = options;
  if (!Number.isInteger(maxAgeMs) || maxAgeMs < 1)
    throw new Error("A stored reading needs a whole, positive maximum age.");
  const entry = z.object({ readAt: z.number(), value: schema }).strict();
  const nameOf = (key: string) => `${prefix}:${key}`;
  return {
    read: (key) => {
      try {
        const raw = storage?.getItem(nameOf(key)) ?? null;
        if (raw === null) return null;
        const parsed = entry.safeParse(JSON.parse(raw));
        if (!parsed.success) return null;
        const age = now().getTime() - parsed.data.readAt;
        // A reading dated in the future is as untrustworthy as an old one.
        if (age < 0 || age >= maxAgeMs) return null;
        return {
          readAt: new Date(parsed.data.readAt),
          value: parsed.data.value,
        };
      } catch {
        return null;
      }
    },
    remove: (key) => {
      try {
        storage?.removeItem(nameOf(key));
      } catch {
        // Nothing stored that could be removed.
      }
    },
    write: (key, reading) => {
      try {
        storage?.setItem(
          nameOf(key),
          JSON.stringify({
            readAt: reading.readAt.getTime(),
            value: reading.value,
          }),
        );
      } catch {
        // Storage is full or blocked: the reading is simply not kept.
      }
    },
  };
}
