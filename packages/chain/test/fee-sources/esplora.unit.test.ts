import { describe, expect, it } from "vitest";

import {
  createFeeSource,
  probeFeeSource,
  type GetLike,
} from "../../src/fee-sources/index.ts";
import { ChainUnavailableError } from "../../src/ports.ts";

// Estimates the way Esplora gives them: a rate for each target, sparse after 25. Each a different number, so a wrong pick shows.
const estimates = {
  "1": 9,
  "2": 8,
  "3": 7,
  "6": 5,
  "12": 3,
  "25": 2,
  "144": 1.5,
  "1008": 1,
};

function answering(body: unknown, status = 200): GetLike {
  return () =>
    Promise.resolve({
      json: () => Promise.resolve(body),
      ok: status >= 200 && status < 300,
      status,
    });
}
const source = (fetch: GetLike) =>
  createFeeSource({
    fetch,
    format: "esplora",
    kind: "explorer",
    timeoutMs: 1000,
    url: "https://explorer.example/net",
  });
const rates = async (body: unknown, targets: readonly number[]) =>
  (await source(answering(body)).feeRates(targets)).map(
    ({ satPerVb }) => satPerVb,
  );

describe("the Esplora fee source", () => {
  it("prices a target at the estimate for that many blocks, and at the nearest one beyond it when the explorer has none for it", async () => {
    expect(await rates(estimates, [1, 2, 3, 6, 12, 25])).toEqual([
      9, 8, 7, 5, 3, 2,
    ]);
    // 4 and 5 have no estimate of their own: the one for 6 is the nearest at or beyond them, never a faster (dearer) one.
    expect(await rates(estimates, [4, 5, 7, 13, 100])).toEqual([
      5, 5, 3, 2, 1.5,
    ]);
  });

  it("uses the slowest estimate the explorer has for a target slower than any it quotes", async () => {
    expect(await rates(estimates, [1008, 5000])).toEqual([1, 1]);
  });

  it("does not depend on the order the explorer lists its estimates in", async () => {
    const shuffled = Object.fromEntries(Object.entries(estimates).reverse());
    expect(await rates(shuffled, [1, 4, 144])).toEqual([9, 5, 1.5]);
  });

  it("sorts by blocks even when the explorer's keys are not in numeric order (keys such as 06 keep the order they were listed in)", async () => {
    expect(await rates({ "12": 3, "06": 5, "1": 9 }, [4])).toEqual([5]);
  });

  it("does not take an entry for zero or fewer blocks as the slowest estimate", async () => {
    await expect(
      source(answering({ "0": 99, "-3": 99 })).feeRates([1]),
    ).rejects.toThrow("a map of fee estimates");
  });

  it("asks the Esplora fee-estimates address for the network, once, with a timeout", async () => {
    const seen: { signal: AbortSignal; url: string }[] = [];
    const fetch: GetLike = (url, init) => {
      seen.push({ signal: init.signal, url });
      return answering(estimates)(url, init);
    };
    await source(fetch).feeRates([1, 6]);
    expect(seen.map(({ url }) => url)).toEqual([
      "https://explorer.example/net/api/fee-estimates",
    ]);
    expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("stops on an answer that is not a table of estimates, rather than guess a rate", async () => {
    for (const body of [
      [1, 2],
      "<html>",
      null,
      7,
      {},
      { "1": 0 },
      { "1": -2 },
      { "1": "9" },
    ]) {
      await expect(source(answering(body)).feeRates([1])).rejects.toThrow(
        ChainUnavailableError,
      );
    }
    await expect(source(answering([1])).feeRates([1])).rejects.toThrow(
      "a map of fee estimates",
    );
    await expect(source(answering({ "1": 0 })).feeRates([1])).rejects.toThrow(
      "estimate for 1 blocks",
    );
  });

  it("leaves out an entry whose key is not a number of blocks, and still reads the rest", async () => {
    expect(
      await rates({ "0": 99, "-3": 99, "2.5": 99, "6": 5 }, [1, 6]),
    ).toEqual([5, 5]);
  });

  it("says the source is unavailable when it answers an error status or cannot be reached", async () => {
    await expect(source(answering({}, 503)).feeRates([1])).rejects.toThrow(
      "HTTP 503",
    );
    const broken: GetLike = () => Promise.reject(new Error("offline"));
    await expect(source(broken).feeRates([1])).rejects.toThrow(
      "The fee source could not be reached.",
    );
  });

  it("is looked at when the platform starts, reading the targets it will later use", async () => {
    const targets: number[] = [];
    const fetch: GetLike = () =>
      Promise.resolve({
        json: () => Promise.resolve(estimates),
        ok: true,
        status: 200,
      });
    await expect(
      probeFeeSource({
        fetch,
        format: "esplora",
        kind: "explorer",
        timeoutMs: 1000,
        url: "https://x.example/net",
      }),
    ).resolves.toBeUndefined();
    expect(targets).toEqual([]);
    await expect(
      probeFeeSource({
        fetch: answering({ "1": 0 }),
        format: "esplora",
        kind: "explorer",
        timeoutMs: 1000,
        url: "https://x.example/net",
      }),
    ).rejects.toThrow("estimate for 1 blocks");
  });

  it("refuses a timeout that is not a positive whole number of milliseconds", () => {
    for (const timeoutMs of [0, -5, 1.5])
      expect(() =>
        createFeeSource({
          fetch: answering(estimates),
          format: "esplora",
          kind: "explorer",
          timeoutMs,
          url: "https://x.example",
        }),
      ).toThrow("timeout");
  });
});
