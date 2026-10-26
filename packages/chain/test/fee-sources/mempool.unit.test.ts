import { describe, expect, it } from "vitest";

import { ChainUnavailableError } from "../../src/ports.ts";
import { createFeeSource, type GetLike } from "../../src/fee-sources/index.ts";

// Each level a different number, so a wrong mapping shows.
const recommended = {
  economyFee: 4,
  fastestFee: 7,
  halfHourFee: 6,
  hourFee: 5,
  minimumFee: 1,
};

function answering(body: unknown, status = 200): GetLike {
  return () =>
    Promise.resolve({
      json: () => Promise.resolve(body),
      ok: status >= 200 && status < 300,
      status,
    });
}

const api = (fetch: GetLike) =>
  createFeeSource({
    fetch,
    format: "mempool",
    kind: "explorer",
    timeoutMs: 1000,
    url: "https://explorer.example/net",
  });

describe("the mempool.space fee source", () => {
  it("prices each confirmation target at the level that stands for it", async () => {
    const rates = await api(answering(recommended)).feeRates([
      1, 2, 3, 4, 6, 7, 25,
    ]);
    expect(rates.map(({ satPerVb }) => satPerVb)).toEqual([
      7, 6, 6, 5, 5, 4, 4,
    ]);
    expect(rates.map(({ targetBlocks }) => targetBlocks)).toEqual([
      1, 2, 3, 4, 6, 7, 25,
    ]);
  });

  it("asks the explorer's recommended-fees address for the network, once per look, with a timeout", async () => {
    const seen: { signal: AbortSignal; url: string }[] = [];
    const fetch: GetLike = (url, init) => {
      seen.push({ signal: init.signal, url });
      return answering(recommended)(url, init);
    };
    await createFeeSource({
      fetch,
      format: "mempool",
      kind: "explorer",
      timeoutMs: 1000,
      url: "https://explorer.example/net//",
    }).feeRates([1, 3, 6]);
    expect(seen.map(({ url }) => url)).toEqual([
      "https://explorer.example/net/api/v1/fees/recommended",
    ]);
    expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("stops on an answer that is not a rate, rather than guess one", async () => {
    for (const body of [
      { ...recommended, fastestFee: 0 },
      { ...recommended, hourFee: -1 },
      { ...recommended, halfHourFee: "6" },
      { economyFee: 4, fastestFee: 7, halfHourFee: 6, minimumFee: 1 },
    ] as const) {
      await expect(api(answering(body)).feeRates([1, 3, 6])).rejects.toThrow(
        ChainUnavailableError,
      );
    }
    await expect(api(answering([1, 2])).feeRates([1])).rejects.toThrow(
      "not a fee recommendation",
    );
  });

  it("does not need the levels a target does not use, but still checks the one it does", async () => {
    const { economyFee: _economy, ...withoutEconomy } = recommended;
    void _economy;
    await expect(
      api(answering(withoutEconomy)).feeRates([1]),
    ).resolves.toHaveLength(1);
    await expect(api(answering(withoutEconomy)).feeRates([25])).rejects.toThrow(
      "economyFee",
    );
  });

  it("says the source is unavailable when it answers an error status or cannot be reached", async () => {
    await expect(api(answering({}, 503)).feeRates([1])).rejects.toThrow(
      "HTTP 503",
    );
    const broken: GetLike = () => Promise.reject(new Error("offline"));
    await expect(api(broken).feeRates([1])).rejects.toThrow(
      "The fee source could not be reached.",
    );
    const notJson: GetLike = () =>
      Promise.resolve({
        json: () => Promise.reject(new Error("bad body")),
        ok: true,
        status: 200,
      });
    await expect(api(notJson).feeRates([1])).rejects.toThrow(
      ChainUnavailableError,
    );
  });

  it("refuses a timeout that is not a positive whole number of milliseconds", () => {
    for (const timeoutMs of [0, -5, 1.5]) {
      expect(() =>
        createFeeSource({
          fetch: answering(recommended),
          format: "mempool",
          kind: "explorer",
          timeoutMs,
          url: "https://explorer.example",
        }),
      ).toThrow("timeout");
    }
  });
});
