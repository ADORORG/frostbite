import { describe, expect, it } from "vitest";

import { feeApiFormats, betaNetworks } from "@frostbite/shared/chain";

import {
  createFeeSource,
  probeFeeSource,
  type FeeSourceSettings,
  type GetLike,
} from "../../src/fee-sources/index.ts";

const recommended = {
  economyFee: 4,
  fastestFee: 7,
  halfHourFee: 6,
  hourFee: 5,
  minimumFee: 1,
};
const estimates = { "1": 9, "3": 7, "6": 5, "7": 3 };

function reply(body: unknown, status = 200): ReturnType<GetLike> {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status,
  });
}
// An explorer that answers each address with its body, and records what was asked.
function explorer(answers: (url: string) => unknown, status = 200) {
  const asked: string[] = [];
  const fetch: GetLike = (url) => {
    asked.push(url);
    return reply(answers(url), status);
  };
  return { asked, fetch };
}
const settings = (
  fetch: GetLike,
  overrides: Partial<FeeSourceSettings> = {},
): FeeSourceSettings => ({
  adapter: "mempool",
  fallbackSatPerVb: null,
  fetch,
  network: "signet",
  timeoutMs: 1000,
  ...overrides,
});

describe("the fee adapters", () => {
  // Written out in full, so a link changed by mistake is seen.
  const expected = {
    blockstream: {
      path: "/api/fee-estimates",
      signet: "https://blockstream.info/signet",
      testnet4: "https://blockstream.info/testnet4",
    },
    mempool: {
      path: "/api/v1/fees/recommended",
      signet: "https://mempool.space/signet",
      testnet4: "https://mempool.space/testnet4",
    },
  } as const;

  it("have an entry in this table for every adapter that can be chosen", () => {
    expect(Object.keys(expected).sort()).toEqual([...feeApiFormats].sort());
  });

  for (const adapter of feeApiFormats)
    for (const network of betaNetworks)
      it(`${adapter} on ${network} is read at its own address, once`, async () => {
        const { asked, fetch } = explorer((url) =>
          url.endsWith("fee-estimates") ? estimates : recommended,
        );
        const rates = await createFeeSource(
          settings(fetch, { adapter, network }),
        ).feeRates([1, 6]);
        expect(asked).toEqual([
          `${expected[adapter][network]}${expected[adapter].path}`,
        ]);
        expect(rates.map(({ satPerVb }) => satPerVb)).toEqual(
          adapter === "mempool" ? [7, 5] : [9, 5],
        );
      });

  it("is given the deployment's time limit", async () => {
    const signals: AbortSignal[] = [];
    const fetch: GetLike = (_url, init) => {
      signals.push(init.signal);
      return reply(recommended);
    };
    await createFeeSource(settings(fetch)).feeRates([1]);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(() => createFeeSource(settings(fetch, { timeoutMs: 0 }))).toThrow(
      "timeout",
    );
  });
});

describe("looking at the chosen explorer when the platform starts", () => {
  it("passes an explorer that answers in its own shape, after reading every level", async () => {
    const { asked, fetch } = explorer(() => recommended);
    await expect(probeFeeSource(settings(fetch))).resolves.toBeUndefined();
    expect(asked).toHaveLength(1);
  });

  it.each(["fastestFee", "halfHourFee", "hourFee", "economyFee"])(
    "refuses a mempool answer whose %s is missing, since a step would later need it",
    async (field) => {
      const rest = Object.fromEntries(
        Object.entries(recommended).filter(([name]) => name !== field),
      );
      const { fetch } = explorer(() => rest);
      await expect(probeFeeSource(settings(fetch))).rejects.toThrow(
        `${field} is not a positive number`,
      );
    },
  );

  it("refuses a Blockstream answer with a bad estimate, an error status, or no connection", async () => {
    const blockstream = { adapter: "blockstream" } as const;
    await expect(
      probeFeeSource(settings(explorer(() => ({ "1": 0 })).fetch, blockstream)),
    ).rejects.toThrow("estimate for 1 blocks");
    await expect(
      probeFeeSource(settings(explorer(() => ({}), 503).fetch, blockstream)),
    ).rejects.toThrow("HTTP 503");
    await expect(
      probeFeeSource(
        settings(() => Promise.reject(new Error("ENETUNREACH")), blockstream),
      ),
    ).rejects.toThrow("The fee source could not be reached.");
  });

  it("looks without the fallback, so an unreadable explorer is found", async () => {
    const { fetch } = explorer(() => ({}), 503);
    await expect(
      probeFeeSource(settings(fetch, { fallbackSatPerVb: 2 })),
    ).rejects.toThrow("HTTP 503");
  });
});
