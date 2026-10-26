import { describe, expect, it } from "vitest";

import { withFallback } from "../../src/fee-sources/fallback.ts";
import { createFeeSource } from "../../src/fee-sources/index.ts";
import type {
  FeeSourceSettings,
  GetLike,
} from "../../src/fee-sources/index.ts";

const recommended = {
  economyFee: 4,
  fastestFee: 7,
  halfHourFee: 6,
  hourFee: 5,
};
const answering =
  (body: unknown, status = 200): GetLike =>
  () =>
    Promise.resolve({
      json: () => Promise.resolve(body),
      ok: status < 400,
      status,
    });
const unreachable: GetLike = () => Promise.reject(new Error("offline"));

function source(fetch: GetLike, told: string[], rate: number | null = 2.5) {
  const settings: FeeSourceSettings = {
    adapter: "mempool",
    fallbackSatPerVb: rate,
    fetch,
    network: "signet",
    onFallback: (reason) => told.push(reason),
    timeoutMs: 1000,
  };
  return createFeeSource(settings);
}

describe("the operator's rate as a fallback", () => {
  it("is not used while the explorer answers, and nobody is told anything", async () => {
    const told: string[] = [];
    const rates = await source(answering(recommended), told).feeRates([1, 25]);
    expect(rates.map(({ satPerVb }) => satPerVb)).toEqual([7, 4]);
    expect(told).toEqual([]);
  });

  it("is the rate for every target when the explorer cannot be reached, and says why each time", async () => {
    const told: string[] = [];
    const chain = source(unreachable, told);
    expect(await chain.feeRates([1, 6, 25])).toEqual([
      { satPerVb: 2.5, targetBlocks: 1 },
      { satPerVb: 2.5, targetBlocks: 6 },
      { satPerVb: 2.5, targetBlocks: 25 },
    ]);
    await chain.feeRates([1]);
    expect(told).toEqual([
      "The fee source could not be reached.",
      "The fee source could not be reached.",
    ]);
  });

  it("is also used for an error status and for an answer that is not a fee table", async () => {
    const told: string[] = [];
    for (const fetch of [
      answering({}, 503),
      answering([1]),
      answering({ ...recommended, hourFee: 0 }),
    ])
      expect((await source(fetch, told).feeRates([6]))[0]?.satPerVb).toBe(2.5);
    expect(told).toHaveLength(3);
    expect(told[0]).toContain("HTTP 503");
  });

  it("is not set: the failure stands and nothing is guessed", async () => {
    await expect(source(unreachable, [], null).feeRates([1])).rejects.toThrow(
      "could not be reached",
    );
  });

  it("does not hide a mistake that is not an outage, and refuses a rate that cannot be one", async () => {
    const buggy = {
      feeRates: () => Promise.reject(new TypeError("a bug")),
    };
    await expect(
      withFallback(buggy, 2.5, () => {}).feeRates([1]),
    ).rejects.toThrow("a bug");
    expect(() => source(unreachable, [], 0)).toThrow("positive number");
  });
});
