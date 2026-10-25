import { chainRefSchema, type TransactionIntent } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it, vi } from "vitest";

import { betaChain } from "../../../configs/chains.ts";
import {
  chainConfig,
  createRewardsChain,
  type RewardsPlatform,
} from "../../../configs/rewards-chain.ts";
import { rewardsPlan } from "../../../configs/rewards-plan.ts";
import { rewardsPolicy } from "../../../configs/rewards-policy.ts";

// The chain this deployment runs on (configs/chains.ts), whichever test network that is.
const beta = chainRefSchema.parse(betaChain.chain.chainId);
const url = "https://node.example.invalid/v1/rpc";
const environment: RewardsChainEnvironment = {
  feeSource: { kind: "default" },
  maxFeeSats: 25_000n,
  rpcHeaders: {},
  rpcTimeoutMs: 400,
  rpcUrl: url,
  templatesDirectory: null,
};
const withTemplates: RewardsChainEnvironment = {
  ...environment,
  templatesDirectory: "/srv/templates",
};

function platform() {
  const requests: {
    body: string;
    headers: Readonly<Record<string, string>>;
    url: string;
  }[] = [];
  const reads: string[] = [];
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
    fetch: async (address, init) => {
      requests.push({ body: init.body, headers: init.headers, url: address });
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (init.signal.aborted) throw new Error("timed out");
      const known = init.body.includes("esplora_tx");
      return {
        json: () =>
          Promise.resolve({
            id: (JSON.parse(init.body) as { id: number }).id,
            jsonrpc: "2.0",
            result: "Transaction not found",
          }),
        ok: known,
        status: known ? 200 : 503,
      };
    },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    random: (length) => new Uint8Array(length),
    readFile: (path) => {
      reads.push(path);
      return Promise.reject(new Error("no disk in this test"));
    },
  };
  return { platform, reads, requests };
}

describe("the rewards chain", () => {
  it("does not exist where no node is configured", () => {
    expect(createRewardsChain(null, platform().platform)).toBeNull();
  });

  it("is configured but not offered while the policy keeps the release gate closed", async () => {
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
      expect(closed.chainConfig().releaseGate).toBe("closed");
      expect(
        closed
          .createRewardsChain(environment, platform().platform)
          ?.chain(beta),
      ).toBeNull();
    } finally {
      vi.doUnmock("../../../configs/rewards-policy.ts");
      vi.resetModules();
    }
  });

  it("offers beta with the fee ceiling and the six ports once the gate is open", () => {
    const rewards = createRewardsChain(environment, platform().platform);
    const offered = rewards?.chain(beta);
    expect(offered?.funding.maxFee).toEqual({
      asset: { chain: beta, id: "btc", kind: "native" },
      baseUnits: 25_000n,
    });
    expect(Object.keys(offered?.ports ?? {}).sort()).toEqual([
      "addressCodec",
      "broadcaster",
      "builder",
      "contracts",
      "observer",
      "rewards",
    ]);
    expect(rewards?.chain(chainRefSchema.parse("simnet:one"))).toBeNull();
  });

  it("asks the configured node, naming it as the source of what it observes", async () => {
    const { platform: stand, requests } = platform();
    const ref = { chain: beta, id: "a".repeat(64) };
    const observation = await createRewardsChain(environment, stand)
      ?.chain(beta)
      ?.ports.observer.observe(ref);
    expect(observation).toMatchObject({
      provider: "node.example.invalid",
      status: "not-found",
    });
    expect(requests.map((request) => request.url)).toEqual([url]);
    expect(requests[0]?.body).toContain("esplora_tx");
  });

  it("sends the node's key header with its calls, and only that header otherwise", async () => {
    const ref = { chain: beta, id: "a".repeat(64) };
    for (const [rpcHeaders, sent] of [
      [{ "x-gateway-key": "k3y" }, { "x-gateway-key": "k3y" }],
      [{}, {}],
    ] as const) {
      const { platform: stand, requests } = platform();
      await createRewardsChain({ ...environment, rpcHeaders }, stand)
        ?.chain(beta)
        ?.ports.observer.observe(ref);
      expect(requests[0]?.headers).toEqual({
        ...sent,
        "content-type": "application/json",
      });
    }
  });

  it("gives up on a node that stays silent past the configured time", async () => {
    const observer = createRewardsChain(
      { ...environment, rpcTimeoutMs: 1 },
      platform().platform,
    )?.chain(beta)?.ports.observer;
    await expect(
      observer?.observe({ chain: beta, id: "a".repeat(64) }),
    ).rejects.toThrow();
  });

  it("holds every operation to the decided confirmations, with the gate the policy states", () => {
    const config = chainConfig();
    expect(Object.keys(config.confirmations).sort()).toEqual([
      "define-milestone",
      "deploy",
      "mint",
      "mint-milestone",
      "publish-template",
      "set-claims-paused",
      "transfer",
    ]);
    for (const finality of Object.values(config.confirmations)) {
      expect(finality).toEqual({ kind: "confirmations", required: 1 });
    }
    expect(config.releaseGate).toBe(rewardsPolicy.testChainReleaseGate);
    expect(config.releaseGate).toBe("open");
  });

  describe("administration", () => {
    const intent = (sender: string): TransactionIntent => ({
      chain: beta,
      operation: "publish-template",
      sender: { chain: beta, value: sender },
      templateAt: { chain: beta, family: rewardsPlan.family, id: "4:100" },
      templateId: "game-rewards",
      templateVersion: rewardsPolicy.templates[0].version,
    });
    const sender = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

    it("is refused where no templates are configured", async () => {
      const builder = createRewardsChain(
        environment,
        platform().platform,
      )?.chain(beta)?.ports.builder;
      const refusal = await builder
        ?.build(intent(sender), {
          maxFee: {
            asset: { chain: beta, id: "btc", kind: "native" },
            baseUnits: 1n,
          },
        })
        .catch((error: unknown) => error);
      expect(refusal).toMatchObject({
        code: "unsupported-operation",
        name: "BuildRefusedError",
      });
    });

    it("loads the template from the configured directory once templates are configured", async () => {
      const { platform: stand, reads } = platform();
      const builder = createRewardsChain(withTemplates, stand)?.chain(beta)
        ?.ports.builder;
      const outcome = await builder
        ?.build(intent(sender), {
          maxFee: {
            asset: { chain: beta, id: "btc", kind: "native" },
            baseUnits: 1n,
          },
        })
        .catch((error: unknown) => error);
      expect(reads).toEqual(["/srv/templates/game-rewards.wasm"]);
      expect(outcome).toMatchObject({ message: "no disk in this test" });
    });
  });
});
