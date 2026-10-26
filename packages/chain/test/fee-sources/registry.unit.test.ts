import { describe, expect, it } from "vitest";

import { feeApiFormats } from "@ador/shared/chain";

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

function explorer(
  body: unknown,
  status = 200,
): { asked: string[]; source: FeeSourceSettings } {
  const asked: string[] = [];
  const fetch: GetLike = (url) => {
    asked.push(url);
    return Promise.resolve({
      json: () => Promise.resolve(body),
      ok: status >= 200 && status < 300,
      status,
    });
  };
  return {
    asked,
    source: {
      fetch,
      format: "mempool",
      kind: "explorer",
      timeoutMs: 1000,
      url: "https://fees.example.invalid/signet",
    },
  };
}

describe("looking at the fee source when the platform starts (mempool format)", () => {
  it("passes an explorer that answers in the expected shape, after one look at its recommended-fees address", async () => {
    const { asked, source } = explorer(recommended);
    await expect(probeFeeSource(source)).resolves.toBeUndefined();
    expect(asked).toEqual([
      "https://fees.example.invalid/signet/api/v1/fees/recommended",
    ]);
  });

  it.each(["fastestFee", "halfHourFee", "hourFee", "economyFee"])(
    "refuses an explorer whose %s is missing, since a step would later need it",
    async (field) => {
      const rest = Object.fromEntries(
        Object.entries(recommended).filter(([name]) => name !== field),
      );
      await expect(probeFeeSource(explorer(rest).source)).rejects.toThrow(
        `${field} is not a positive number`,
      );
    },
  );

  it("refuses an explorer that quotes a level that is not a positive number", async () => {
    await expect(
      probeFeeSource(explorer({ ...recommended, hourFee: 0 }).source),
    ).rejects.toThrow("hourFee is not a positive number");
  });

  it("refuses an explorer that answers with an error status, or with something that is not a fee table", async () => {
    await expect(probeFeeSource(explorer({}, 503).source)).rejects.toThrow(
      "HTTP 503",
    );
    await expect(probeFeeSource(explorer([1, 2]).source)).rejects.toThrow();
    await expect(probeFeeSource(explorer("<html>").source)).rejects.toThrow();
  });

  it("refuses an explorer that cannot be reached", async () => {
    const source: FeeSourceSettings = {
      fetch: () => Promise.reject(new Error("ENETUNREACH")),
      format: "mempool",
      kind: "explorer",
      timeoutMs: 1000,
      url: "https://fees.example.invalid/signet",
    };
    await expect(probeFeeSource(source)).rejects.toThrow(
      "The fee source could not be reached.",
    );
  });

  it("has nothing to look at for a fixed rate or for no source", async () => {
    await expect(
      probeFeeSource({ kind: "fixed", satPerVb: 2 }),
    ).resolves.toBeUndefined();
    await expect(probeFeeSource(null)).resolves.toBeUndefined();
  });
});

describe("the registry of fee source formats", () => {
  const explorerOf = (
    format: (typeof feeApiFormats)[number],
  ): FeeSourceSettings => ({
    fetch: () =>
      Promise.resolve({
        json: () => Promise.resolve({}),
        ok: false,
        status: 404,
      }),
    format,
    kind: "explorer",
    timeoutMs: 1000,
    url: "https://fees.example.invalid/signet",
  });

  it("has an adapter for every format that can be configured, and each is looked at on its own address", async () => {
    const addresses: Record<string, string> = {};
    for (const format of feeApiFormats) {
      const asked: string[] = [];
      const settings: FeeSourceSettings = {
        ...explorerOf(format),
        fetch: (url) => {
          asked.push(url);
          return Promise.resolve({
            json: () => Promise.resolve({}),
            ok: false,
            status: 404,
          });
        },
      } as FeeSourceSettings;
      await expect(probeFeeSource(settings)).rejects.toThrow("HTTP 404");
      addresses[format] = asked[0] ?? "";
    }
    expect(addresses).toEqual({
      esplora: "https://fees.example.invalid/signet/api/fee-estimates",
      mempool: "https://fees.example.invalid/signet/api/v1/fees/recommended",
    });
  });

  it("makes the source the settings name: an explorer of that format, or the operator's fixed rate", async () => {
    expect(
      await createFeeSource({ kind: "fixed", satPerVb: 4 }).feeRates([2]),
    ).toEqual([{ satPerVb: 4, targetBlocks: 2 }]);
  });
});
