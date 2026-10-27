import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertReadPolicy, createReadCache } from "../src/index.ts";

const start = Date.parse("2026-10-27T12:00:00.000Z");
const clock = { at: start };
beforeEach(() => {
  clock.at = start;
});
const now = () => new Date(clock.at);
const later = (ms: number) => {
  clock.at += ms;
};
const cache = (
  freshMs: number,
  maxStaleMs: number,
  onRefreshFailed?: (key: string) => void,
) =>
  createReadCache<number>({
    now,
    ...(onRefreshFailed === undefined ? {} : { onRefreshFailed }),
    policy: { freshMs, maxStaleMs },
  });
const counting = (...values: number[]) => {
  let calls = 0;
  const ask = vi.fn(
    async () => values[Math.min(calls++, values.length - 1)] ?? 0,
  );
  return ask;
};

describe("a read cache without stale serving (a plain time-to-live)", () => {
  it("serves one reading for the time to live, with when it was read, and reads again after it", async () => {
    const ask = counting(1, 2);
    const readings = cache(1_000, 1_000);
    const first = await readings.read("a", ask);
    later(999);
    expect((await readings.read("a", ask)).value).toBe(1);
    expect(first.readAt).toEqual(new Date("2026-10-27T12:00:00.000Z"));
    later(1);
    const second = await readings.read("a", ask);
    expect(second.value).toBe(2);
    expect(second.readAt).toEqual(now());
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("keeps each key's reading apart", async () => {
    const readings = cache(1_000, 1_000);
    expect((await readings.read("a", async () => 1)).value).toBe(1);
    expect((await readings.read("b", async () => 2)).value).toBe(2);
    expect((await readings.read("a", async () => 9)).value).toBe(1);
  });

  it("lets callers that arrive while a reading is on its way share it", async () => {
    let finish: (value: number) => void = () => undefined;
    const ask = vi.fn(
      () => new Promise<number>((resolve) => (finish = resolve)),
    );
    const readings = cache(1_000, 1_000);
    const all = [
      readings.read("a", ask),
      readings.read("a", ask),
      readings.read("a", ask),
    ];
    finish(7);
    expect((await Promise.all(all)).map(({ value }) => value)).toEqual([
      7, 7, 7,
    ]);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("never keeps a reading that failed, and says so to every caller sharing it", async () => {
    const ask = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(5);
    const readings = cache(1_000, 1_000);
    await expect(readings.read("a", ask)).rejects.toThrow("down");
    expect((await readings.read("a", ask)).value).toBe(5);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("turns a reading that throws at once into a rejection", async () => {
    const readings = cache(1_000, 1_000);
    await expect(
      readings.read("a", () => {
        throw new Error("sync");
      }),
    ).rejects.toThrow("sync");
  });

  it("asks again, rather than wait for, a reading still pending after the time to live, and lets the old one end without replacing the newer", async () => {
    let finishOld: (value: number) => void = () => undefined;
    const ask = vi
      .fn<() => Promise<number>>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishOld = resolve)),
      )
      .mockResolvedValueOnce(2);
    const readings = cache(1_000, 1_000);
    const old = readings.read("a", ask);
    later(1_000);
    expect((await readings.read("a", ask)).value).toBe(2);
    finishOld(1);
    expect((await old).value).toBe(1);
    expect((await readings.read("a", ask)).value).toBe(2);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("lets a late old reading end without making the newer one, still on its way, unshared", async () => {
    let finishOld: (value: number) => void = () => undefined;
    let finishNew: (value: number) => void = () => undefined;
    const ask = vi
      .fn<() => Promise<number>>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishOld = resolve)),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishNew = resolve)),
      );
    const readings = cache(1_000, 1_000);
    const old = readings.read("a", ask);
    later(1_000);
    const newer = readings.read("a", ask);
    finishOld(1);
    await old;
    // A third caller still joins the newer reading rather than starting another.
    const third = readings.read("a", ask);
    finishNew(2);
    expect([(await newer).value, (await third).value]).toEqual([2, 2]);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("does not let an old failure remove a newer reading", async () => {
    let failOld: (error: Error) => void = () => undefined;
    const ask = vi
      .fn<() => Promise<number>>()
      .mockImplementationOnce(
        () => new Promise((_resolve, reject) => (failOld = reject)),
      )
      .mockResolvedValueOnce(2);
    const readings = cache(1_000, 1_000);
    const old = readings.read("a", ask);
    old.catch(() => undefined);
    later(1_000);
    await readings.read("a", ask);
    failOld(new Error("late"));
    await expect(old).rejects.toThrow("late");
    expect((await readings.read("a", ask)).value).toBe(2);
    expect(ask).toHaveBeenCalledTimes(2);
  });
});

describe("a read cache that serves an old reading while it takes a new one", () => {
  it("serves the old reading at once between the fresh time and the stale limit, and the new one once it has arrived", async () => {
    let finish: (value: number) => void = () => undefined;
    const ask = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finish = resolve)),
      );
    const readings = cache(1_000, 5_000);
    await readings.read("a", ask);
    later(1_000);
    const served = await readings.read("a", ask);
    expect(served.value).toBe(1);
    expect(served.readAt).toEqual(new Date("2026-10-27T12:00:00.000Z"));
    // Still on its way: others are served the old one and do not start another.
    expect((await readings.read("a", ask)).value).toBe(1);
    expect(ask).toHaveBeenCalledTimes(2);
    finish(2);
    await Promise.resolve();
    await Promise.resolve();
    const fresh = await readings.read("a", ask);
    expect(fresh.value).toBe(2);
    expect(fresh.readAt).toEqual(now());
  });

  it("keeps serving the old reading when the new one fails, tells which key failed, and tries again later", async () => {
    const failed: string[] = [];
    const ask = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(3);
    const readings = cache(1_000, 5_000, (key) => failed.push(key));
    await readings.read("a", ask);
    later(1_000);
    expect((await readings.read("a", ask)).value).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(failed).toEqual(["a"]);
    expect((await readings.read("a", ask)).value).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect((await readings.read("a", ask)).value).toBe(3);
  });

  it("does not need anyone to be told of a failed refresh", async () => {
    const ask = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("down"));
    const readings = cache(1_000, 5_000);
    await readings.read("a", ask);
    later(1_000);
    expect((await readings.read("a", ask)).value).toBe(1);
  });

  it("never serves a reading older than the stale limit: it waits for a new one, or fails", async () => {
    const ask = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(3);
    const readings = cache(1_000, 5_000);
    await readings.read("a", ask);
    later(5_000);
    await expect(readings.read("a", ask)).rejects.toThrow("down");
    expect((await readings.read("a", ask)).value).toBe(3);
  });
});

describe("a read policy", () => {
  it("takes whole, non-negative milliseconds with the stale limit not below the fresh time", () => {
    expect(() => assertReadPolicy({ freshMs: 0, maxStaleMs: 0 })).not.toThrow();
    for (const policy of [
      { freshMs: -1, maxStaleMs: 5 },
      { freshMs: 1.5, maxStaleMs: 5 },
      { freshMs: 5, maxStaleMs: 4 },
      { freshMs: 5, maxStaleMs: Number.NaN },
      { freshMs: 5, maxStaleMs: 5.5 },
    ])
      expect(() => assertReadPolicy(policy)).toThrow("read policy");
    expect(() => cache(10, 5)).toThrow("read policy");
  });
});
