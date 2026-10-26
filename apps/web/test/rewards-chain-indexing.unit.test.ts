import { chainRefSchema } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it, vi } from "vitest";

import { betaChain } from "../../../configs/chains.ts";
import {
  createRewardsChain,
  type RewardsPlatform,
} from "../../../configs/rewards-chain.ts";
import { rewardsPolicy } from "../../../configs/rewards-policy.ts";

// The chain this deployment runs on (configs/chains.ts), whichever test network that is.
const beta = chainRefSchema.parse(betaChain.chain.chainId);
const environment: RewardsChainEnvironment = {
  feeSource: { adapter: "mempool", fallbackSatPerVb: null },
  maxFeeSats: 25_000n,
  rpcHeaders: {},
  rpcTimeoutMs: 400,
  rpcUrl: "https://node.example.invalid/v1/rpc",
  templatesDirectory: null,
};

// A node that reports the chain's tip and how far its indexer has read, and counts what it was asked.
function node(heights: { indexed: number; tip: number }) {
  const asked: string[] = [];
  const clock = { now: new Date("2026-10-17T12:00:00.000Z") };
  const down = { value: false };
  const platform: RewardsPlatform = {
    get: async () => ({
      json: () =>
        Promise.resolve({
          economyFee: 1,
          fastestFee: 1,
          halfHourFee: 1,
          hourFee: 1,
          minimumFee: 1,
        }),
      ok: true,
      status: 200,
    }),
    fetch: async (_address, init) => {
      const { id, method } = JSON.parse(init.body) as {
        id: number;
        method: string;
      };
      asked.push(method);
      if (down.value)
        return { json: () => Promise.resolve({}), ok: false, status: 503 };
      const result: Record<string, string | number> = {
        "esplora_blocks:tip:hash": "ab".repeat(32),
        "esplora_blocks:tip:height": heights.tip,
        metashrew_height: String(heights.indexed),
      };
      return {
        json: () =>
          Promise.resolve({ id, jsonrpc: "2.0", result: result[method] }),
        ok: true,
        status: 200,
      };
    },
    now: () => clock.now,
    random: (length) => new Uint8Array(length),
    readFile: () => Promise.reject(new Error("no disk in this test")),
  };
  return { asked, clock, down, platform };
}

describe("how far the rewards chain's indexer has read", () => {
  it("names the chain and reports the tip and the indexer's height as the node gave them", async () => {
    const { platform } = node({ indexed: 325_681, tip: 326_770 });
    const followed = createRewardsChain(environment, platform)?.followed;
    expect(followed?.displayName).toBe(betaChain.chain.displayName);
    expect(await followed?.indexing()).toEqual({
      chain: beta,
      indexedHeight: 325_681,
      observedAt: "2026-10-17T12:00:00.000Z",
      tipHeight: 326_770,
    });
  });

  it("asks the node once however many ask within the reuse time, and again after it", async () => {
    const { asked, clock, platform } = node({ indexed: 10, tip: 12 });
    const followed = createRewardsChain(environment, platform)?.followed;
    await Promise.all([
      followed?.indexing(),
      followed?.indexing(),
      followed?.indexing(),
    ]);
    const ask = () => asked.filter((method) => method === "metashrew_height");
    expect(ask()).toHaveLength(1);
    clock.now = new Date(
      clock.now.getTime() + rewardsPolicy.indexingReadingMs - 1,
    );
    await followed?.indexing();
    expect(ask()).toHaveLength(1);
    clock.now = new Date(clock.now.getTime() + 1);
    await followed?.indexing();
    expect(ask()).toHaveLength(2);
  });

  it("is the same cached reading the services' observer gives, so a service and the lamp never ask twice", async () => {
    const { asked, platform } = node({ indexed: 10, tip: 12 });
    const rewards = createRewardsChain(environment, platform);
    await rewards?.followed.indexing();
    await rewards?.chain(beta)?.ports.observer.indexing(beta);
    expect(
      asked.filter((method) => method === "metashrew_height"),
    ).toHaveLength(1);
  });

  it("rejects when the node cannot be asked, and does not remember the failure", async () => {
    const { down, platform } = node({ indexed: 10, tip: 12 });
    const followed = createRewardsChain(environment, platform)?.followed;
    down.value = true;
    await expect(followed?.indexing()).rejects.toThrow();
    down.value = false;
    expect((await followed?.indexing())?.tipHeight).toBe(12);
  });

  it("is readable while the policy keeps the release gate closed, because reading moves nothing", async () => {
    vi.resetModules();
    vi.doMock("../../../configs/rewards-policy.ts", async (original) => {
      const real =
        await original<typeof import("../../../configs/rewards-policy.ts")>();
      return {
        ...real,
        rewardsPolicy: {
          ...real.rewardsPolicy,
          testChainReleaseGate: "closed",
        },
      };
    });
    try {
      const closed = await import("../../../configs/rewards-chain.ts");
      const rewards = closed.createRewardsChain(
        environment,
        node({ indexed: 1, tip: 2 }).platform,
      );
      expect(rewards?.chain(beta)).toBeNull();
      expect((await rewards?.followed.indexing())?.tipHeight).toBe(2);
    } finally {
      vi.doUnmock("../../../configs/rewards-policy.ts");
      vi.resetModules();
    }
  });
});
