import { describe, expect, it } from "vitest";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";

import { betaChains } from "../../../configs/chains.ts";
import {
  createRewardsChain,
  type RewardsPlatform,
} from "../../../configs/rewards-chain.ts";

const base: RewardsChainEnvironment = {
  feeSource: { kind: "default" },
  maxFeeSats: 100_000n,
  rpcHeaders: {},
  rpcTimeoutMs: 400,
  rpcUrl: "https://node.example.invalid/v1/rpc",
  templatesDirectory: null,
};
const mirror: RewardsChainEnvironment = {
  ...base,
  feeSource: {
    format: "mempool",
    kind: "explorer",
    url: "https://fees.example.invalid/mirror",
  },
};

// A platform whose public fetch is the explorer, and whose node must never be asked at startup.
function platform(
  explorer: (url: string) => Promise<unknown>,
  explorerAsked: string[] = [],
): RewardsPlatform {
  return {
    fetch: () => Promise.reject(new Error("the node is not asked")),
    get: async (url) => {
      explorerAsked.push(url);
      const body = await explorer(url);
      return { json: () => Promise.resolve(body), ok: true, status: 200 };
    },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    random: (length) => new Uint8Array(length),
    readFile: () => Promise.reject(new Error("no disk in this test")),
  };
}

const levels = {
  economyFee: 1,
  fastestFee: 3,
  halfHourFee: 2,
  hourFee: 2,
};
const beta = betaChains.signet;

describe("what the platform looks at when it starts", () => {
  it("passes when the explorer the operator named answers as an explorer does, after looking once", async () => {
    const asked: string[] = [];
    const rewards = createRewardsChain(
      mirror,
      platform(async () => levels, asked),
      beta,
    );
    await expect(rewards?.startupCheck()).resolves.toBeUndefined();
    expect(asked).toEqual([
      "https://fees.example.invalid/mirror/api/v1/fees/recommended",
    ]);
  });

  it("stops, naming the setting and the host, when that explorer's answer is not the expected shape", async () => {
    const rewards = createRewardsChain(
      mirror,
      platform(async () => ({ fastestFee: 3 })),
      beta,
    );
    await expect(rewards?.startupCheck()).rejects.toThrow(
      "REWARDS_FEE_API_URL (fees.example.invalid, read as mempool) is not usable: The fee source's halfHourFee is not a positive number.",
    );
  });

  it("stops, naming the setting, when that explorer cannot be reached", async () => {
    const rewards = createRewardsChain(
      mirror,
      platform(() => Promise.reject(new Error("ENETUNREACH"))),
      beta,
    );
    await expect(rewards?.startupCheck()).rejects.toThrow(
      "REWARDS_FEE_API_URL (fees.example.invalid, read as mempool) is not usable: The fee source could not be reached.",
    );
  });

  it.each([
    ["the network's default explorer", base],
    [
      "a fixed rate",
      { ...base, feeSource: { kind: "fixed", satPerVb: 2 } } as const,
    ],
  ])("asks nobody for %s", async (_name, environment) => {
    const asked: string[] = [];
    const rewards = createRewardsChain(
      environment,
      platform(() => Promise.reject(new Error("must not be asked")), asked),
      beta,
    );
    await expect(rewards?.startupCheck()).resolves.toBeUndefined();
    expect(asked).toEqual([]);
  });
});
