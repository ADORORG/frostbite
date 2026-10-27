import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createExpiringStore,
  type KeyValueStorage,
} from "../src/expiring-store.ts";

const start = Date.parse("2026-10-27T12:00:00.000Z");
const clock = { at: start };
beforeEach(() => {
  clock.at = start;
});
const memory = (): KeyValueStorage & { items: Map<string, string> } => {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    items,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
};
const schema = z.object({ sats: z.number().int() }).strict();
const storeOn = (storage: KeyValueStorage | null, maxAgeMs = 1_000) =>
  createExpiringStore({
    maxAgeMs,
    now: () => new Date(clock.at),
    prefix: "balance",
    schema,
    storage,
  });
const reading = (sats: number) => ({
  readAt: new Date(clock.at),
  value: { sats },
});

describe("an expiring store", () => {
  it("gives back what was written, with when it was read, until it is too old", () => {
    const store = storeOn(memory());
    store.write("a", reading(5));
    expect(store.read("a")).toEqual(reading(5));
    clock.at += 999;
    expect(store.read("a")?.value).toEqual({ sats: 5 });
    clock.at += 1;
    expect(store.read("a")).toBeNull();
  });

  it("keeps keys and prefixes apart, and forgets one on request", () => {
    const storage = memory();
    const store = storeOn(storage);
    store.write("a", reading(1));
    store.write("b", reading(2));
    expect([...storage.items.keys()]).toEqual(["balance:a", "balance:b"]);
    store.remove("a");
    expect(store.read("a")).toBeNull();
    expect(store.read("b")?.value.sats).toBe(2);
  });

  it("treats what it cannot trust as nothing: not JSON, the wrong shape, extra fields, or dated in the future", () => {
    const storage = memory();
    const store = storeOn(storage);
    for (const raw of [
      "not json",
      "null",
      JSON.stringify({ readAt: clock.at, value: { sats: "5" } }),
      JSON.stringify({ readAt: clock.at, value: { sats: 5 }, extra: 1 }),
      JSON.stringify({ readAt: clock.at + 1, value: { sats: 5 } }),
      JSON.stringify({ value: { sats: 5 } }),
    ]) {
      storage.items.set("balance:a", raw);
      expect(store.read("a")).toBeNull();
    }
  });

  it("is a miss, never an error, where storage is missing or refuses", () => {
    const missing = storeOn(null);
    missing.write("a", reading(1));
    missing.remove("a");
    expect(missing.read("a")).toBeNull();
    const refusing: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    const store = storeOn(refusing);
    store.write("a", reading(1));
    store.remove("a");
    expect(store.read("a")).toBeNull();
  });

  it("refuses a maximum age that is not a whole, positive number of milliseconds", () => {
    for (const maxAgeMs of [0, -1, 1.5, Number.NaN])
      expect(() => storeOn(memory(), maxAgeMs)).toThrow("maximum age");
  });
});
