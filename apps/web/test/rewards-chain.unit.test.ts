import { chainRefSchema, type TransactionIntent } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it } from "vitest";

import { bitcoinSignetChainId } from "../../../configs/chains.ts";
import {
  chainConfig,
  createRewardsChain,
  templateSettings,
  type RewardsPlatform,
} from "../../../configs/rewards-chain.ts";
import { rewardsPolicy } from "../../../configs/rewards-policy.ts";

const signet = chainRefSchema.parse(bitcoinSignetChainId);
const url = "https://node.example.invalid/v1/rpc";
const environment: RewardsChainEnvironment = {
  contracts: new Map([["arcade", { id: "4:200", maxDrawingBytes: 2048n }]]),
  maxFeeSats: 25_000n,
  releaseGate: "open",
  rpcTimeoutMs: 400,
  rpcUrl: url,
  templates: null,
};
const withTemplates: RewardsChainEnvironment = {
  ...environment,
  templates: {
    directory: "/srv/templates",
    ids: { "game-rewards": "4:100", "milestone-collectible": "4:101" },
  },
};

function platform() {
  const requests: { body: string; url: string }[] = [];
  const reads: string[] = [];
  const platform: RewardsPlatform = {
    fetch: async (address, init) => {
      requests.push({ body: init.body, url: address });
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

  it("is configured but not offered while the release gate is closed", () => {
    const rewards = createRewardsChain(
      { ...environment, releaseGate: "closed" },
      platform().platform,
    );
    expect(rewards?.chain(signet)).toBeNull();
    expect(rewards?.contracts.size).toBe(1);
  });

  it("offers signet with the fee ceiling and the six ports once the gate is open", () => {
    const rewards = createRewardsChain(environment, platform().platform);
    const offered = rewards?.chain(signet);
    expect(offered?.funding.maxFee).toEqual({
      asset: { chain: signet, id: "btc", kind: "native" },
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

  it("lists each game's contract on signet and the drawing size it accepts", () => {
    const rewards = createRewardsChain(environment, platform().platform);
    expect(rewards?.contracts.get("arcade")).toEqual({
      chain: signet,
      family: "bitcoin-alkanes",
      id: "4:200",
    });
    expect(rewards?.maxDrawingBytes.get("arcade")).toBe(2048n);
  });

  it("asks the configured node, naming it as the source of what it observes", async () => {
    const { platform: stand, requests } = platform();
    const ref = { chain: signet, id: "a".repeat(64) };
    const observation = await createRewardsChain(environment, stand)
      ?.chain(signet)
      ?.ports.observer.observe(ref);
    expect(observation).toMatchObject({
      provider: "node.example.invalid",
      status: "not-found",
    });
    expect(requests.map((request) => request.url)).toEqual([url]);
    expect(requests[0]?.body).toContain("esplora_tx");
  });

  it("gives up on a node that stays silent past the configured time", async () => {
    const observer = createRewardsChain(
      { ...environment, rpcTimeoutMs: 1 },
      platform().platform,
    )?.chain(signet)?.ports.observer;
    await expect(
      observer?.observe({ chain: signet, id: "a".repeat(64) }),
    ).rejects.toThrow();
  });

  it("gives each template the Alkane the deployment publishes it at", () => {
    expect(
      templateSettings({
        "game-rewards": "4:100",
        "milestone-collectible": "4:101",
      }).map(({ alkane, crate }) => [crate, alkane]),
    ).toEqual([
      ["game-rewards", "4:100"],
      ["milestone-collectible", "4:101"],
    ]);
  });

  it("holds every operation to the decided confirmations, and keeps the gate as configured", () => {
    const config = chainConfig(environment);
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
    expect(config.releaseGate).toBe("open");
    expect(
      chainConfig({ ...environment, releaseGate: "closed" }).releaseGate,
    ).toBe("closed");
  });

  describe("administration", () => {
    const intent = (sender: string): TransactionIntent => ({
      chain: signet,
      operation: "publish-template",
      sender: { chain: signet, value: sender },
      templateId: "game-rewards",
      templateVersion: rewardsPolicy.templates[0].version,
    });
    const sender = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

    it("is refused where no templates are configured", async () => {
      const builder = createRewardsChain(
        environment,
        platform().platform,
      )?.chain(signet)?.ports.builder;
      const refusal = await builder
        ?.build(intent(sender), {
          maxFee: {
            asset: { chain: signet, id: "btc", kind: "native" },
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
      const builder = createRewardsChain(withTemplates, stand)?.chain(signet)
        ?.ports.builder;
      const outcome = await builder
        ?.build(intent(sender), {
          maxFee: {
            asset: { chain: signet, id: "btc", kind: "native" },
            baseUnits: 1n,
          },
        })
        .catch((error: unknown) => error);
      expect(reads).toEqual(["/srv/templates/game-rewards.wasm"]);
      expect(outcome).toMatchObject({ message: "no disk in this test" });
    });
  });
});
