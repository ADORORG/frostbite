import { chainRefSchema, type IndexingStatus } from "@ador/shared/chain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChainObserver } from "../src/ports.ts";
import { createStatusReadings } from "../src/status-readings.ts";

const chain = chainRefSchema.parse("bip122:00000008819873e925422c1ff0f99f7c");
const start = Date.parse("2026-10-27T12:00:00.000Z");
const clock = { at: start };
beforeEach(() => {
  clock.at = start;
});
const policy = { freshMs: 15_000, maxStaleMs: 600_000 };
const status = (indexedHeight: number): IndexingStatus => ({
  chain,
  indexedHeight,
  observedAt: new Date(clock.at).toISOString(),
  tipHeight: 100,
});
const observerOf = (over: Partial<ChainObserver>): ChainObserver => ({
  balance: () => Promise.reject(new Error("not used")),
  feeRates: () => Promise.reject(new Error("not used")),
  indexing: () => Promise.reject(new Error("not used")),
  observe: () => Promise.reject(new Error("not used")),
  tip: () => Promise.reject(new Error("not used")),
  ...over,
});
const readingsOf = (
  over: Partial<ChainObserver>,
  onRefreshFailed?: (key: string) => void,
) =>
  createStatusReadings(observerOf(over), chain, {
    now: () => new Date(clock.at),
    ...(onRefreshFailed === undefined ? {} : { onRefreshFailed }),
    policy,
  });
const rates = (targets: readonly number[]) =>
  targets.map((target) => ({ satPerVb: 2, targetBlocks: target }));

describe("the readings a public status page shows", () => {
  it("reads each of the three once for a crowd, asking the chain it was made for", async () => {
    const indexing = vi.fn(async () => status(99));
    const tip = vi.fn(async () => 100);
    const feeRates = vi.fn(
      async (_chain: unknown, targets: readonly number[]) => rates(targets),
    );
    const readings = readingsOf({ feeRates, indexing, tip });
    await Promise.all(
      Array.from({ length: 20 }, async () => {
        await readings.indexing();
        await readings.tipHeight();
        await readings.feeRates([1, 6]);
      }),
    );
    expect(indexing).toHaveBeenCalledTimes(1);
    expect(indexing).toHaveBeenCalledWith(chain);
    expect(tip).toHaveBeenCalledWith(chain);
    expect(tip).toHaveBeenCalledTimes(1);
    expect(feeRates).toHaveBeenCalledTimes(1);
    expect(feeRates).toHaveBeenCalledWith(chain, [1, 6]);
  });

  it("keeps quotes for different targets apart", async () => {
    const feeRates = vi.fn(
      async (_chain: unknown, targets: readonly number[]) => rates(targets),
    );
    const readings = readingsOf({ feeRates });
    expect((await readings.feeRates([1])).value).toEqual(rates([1]));
    expect((await readings.feeRates([6])).value).toEqual(rates([6]));
    expect(feeRates).toHaveBeenCalledTimes(2);
  });

  it("serves the last good reading, with when it was read, while the node is failing, for no longer than the stale limit", async () => {
    const failed: string[] = [];
    const feeRates = vi
      .fn<ChainObserver["feeRates"]>()
      .mockImplementationOnce(async (_chain, targets) => rates(targets))
      .mockRejectedValue(new Error("the node is down"));
    const indexing = vi
      .fn<ChainObserver["indexing"]>()
      .mockResolvedValueOnce(status(99))
      .mockRejectedValue(new Error("the node is down"));
    const tip = vi
      .fn<ChainObserver["tip"]>()
      .mockResolvedValueOnce(100)
      .mockRejectedValue(new Error("the node is down"));
    const readings = readingsOf({ feeRates, indexing, tip }, (key) =>
      failed.push(key),
    );
    await readings.feeRates([1]);
    await readings.indexing();
    await readings.tipHeight();

    clock.at += 120_000;
    const quoted = await readings.feeRates([1]);
    expect(quoted.value).toEqual(rates([1]));
    expect(quoted.readAt).toEqual(new Date(start));
    expect((await readings.indexing()).indexedHeight).toBe(99);
    expect(await readings.tipHeight()).toBe(100);
    await Promise.resolve();
    await Promise.resolve();
    expect([...failed].sort()).toEqual(["fees|1", "indexing", "tip"]);

    clock.at += 600_000;
    await expect(readings.feeRates([1])).rejects.toThrow("down");
    await expect(readings.indexing()).rejects.toThrow("down");
    await expect(readings.tipHeight()).rejects.toThrow("down");
  });

  it("refuses a policy that cannot serve", () => {
    expect(() =>
      createStatusReadings(observerOf({}), chain, {
        now: () => new Date(clock.at),
        policy: { freshMs: 10, maxStaleMs: 5 },
      }),
    ).toThrow("read policy");
  });
});
