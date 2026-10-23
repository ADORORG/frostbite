import { createHash } from "node:crypto";

import { chainRefSchema, type ChainConfig } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import {
  createConfiguredRegistry,
  feeCeiling,
  type AlkanesChainSettings,
  type ConfiguredChain,
} from "../src/configured.ts";
import { bitcoinAlkanesFamily } from "../src/bitcoin-alkanes/adapter.ts";

const chain = chainRefSchema.parse("bip122:00000008819873e925422c1ff0f99f7c");
const finality = { kind: "confirmations", required: 1 } as const;
const config = (releaseGate: "closed" | "open"): ChainConfig => ({
  chainId: chain,
  confirmations: {
    deploy: finality,
    mint: finality,
    "mint-milestone": finality,
    "publish-template": finality,
    "define-milestone": finality,
    "set-claims-paused": finality,
    transfer: finality,
  },
  displayName: "Signet",
  enabled: true,
  family: bitcoinAlkanesFamily,
  releaseGate,
  role: "public-beta",
});

const requests: string[] = [];
const settings = (
  administration: AlkanesChainSettings["administration"],
): AlkanesChainSettings => ({
  administration,
  chain,
  maxPreviewBytes: 1024,
  network: "signet",
  now: () => new Date("2026-01-01T00:00:00.000Z"),
  rpc: {
    headers: {},
    fetch: async (url, init) => {
      requests.push(url);
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (init.signal.aborted) throw new Error("timed out");
      const id = (JSON.parse(init.body) as { id: number }).id;
      return {
        json: () =>
          Promise.resolve({
            id,
            jsonrpc: "2.0",
            result: "Transaction not found",
          }),
        ok: true,
        status: 200,
      };
    },
    timeoutMs: 400,
    url: "https://user:key@node.example.invalid/rpc",
  },
  transactions: {
    changeDustSats: 294n,
    templateSequence: { attempts: 200, first: 1000n },
    claimOutputSats: 546n,
    feeTargetBlocks: 3,
    feeSpeeds: {
      fast: { approxMinutes: 30, targetBlocks: 3 },
      lightning: { approxMinutes: 15, targetBlocks: 1 },
      medium: { approxMinutes: 60, targetBlocks: 6 },
      slow: { approxMinutes: 250, targetBlocks: 25 },
    },
    lifetimeMs: 60_000,
  },
});

const code = Uint8Array.from({ length: 11 }, (_v, index) => index);
const template = (crate: "game-rewards" | "milestone-collectible") => ({
  codeHash: createHash("sha256").update(code).digest("hex"),
  crate,
  version: "1.0.0",
});
const administration = (maxCodeBytes: number) => ({
  maxCodeBytes,
  maxDrawingBytes: 4096n,
  random: (length: number) => new Uint8Array(length),
  read: () => Promise.resolve(code),
  templates: [template("game-rewards"), template("milestone-collectible")],
});
const publish = {
  chain,
  operation: "publish-template",
  templateAt: { chain, family: bitcoinAlkanesFamily, id: "4:100" },
  sender: { chain, value: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx" },
  templateId: "game-rewards",
  templateVersion: "1.0.0",
} as const;

const configured = (
  administration: AlkanesChainSettings["administration"] = null,
  gate: "closed" | "open" = "open",
): ConfiguredChain => ({
  adapter: { kind: "bitcoin-alkanes", settings: settings(administration) },
  config: config(gate),
});

describe("the configured registry", () => {
  it("serves the chain's neutral ports and says whether broadcast is allowed", () => {
    const open = createConfiguredRegistry([configured()]);
    expect(open.broadcastAllowed(chain)).toBe(true);
    expect(open.supports(chain, "transaction:build")).toBe(true);
    expect(
      createConfiguredRegistry([configured(null, "closed")]).broadcastAllowed(
        chain,
      ),
    ).toBe(false);
  });

  it("names the node in what it observes by its host, never with the key in its address", async () => {
    const observer = createConfiguredRegistry([configured()]).port(
      chain,
      "observer",
    );
    const observation = await observer.observe({ chain, id: "a".repeat(64) });
    expect(observation).toMatchObject({
      provider: "node.example.invalid",
      status: "not-found",
    });
    expect(JSON.stringify(observation)).not.toContain("key");
    expect(requests).toContain("https://user:key@node.example.invalid/rpc");
  });

  it("refuses staff steps without administration, and loads a template with it", async () => {
    const intent = {
      chain,
      operation: "publish-template",
      templateAt: { chain, family: bitcoinAlkanesFamily, id: "4:100" },
      sender: { chain, value: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx" },
      templateId: "game-rewards",
      templateVersion: "1.0.0",
    } as const;
    const funding = feeCeiling(configured(), 1000n);
    const without = createConfiguredRegistry([configured()]).port(
      chain,
      "builder",
    );
    await expect(without.build(intent, funding)).rejects.toMatchObject({
      code: "unsupported-operation",
    });
    const loaded: string[] = [];
    const withAdministration = createConfiguredRegistry([
      configured({
        maxCodeBytes: 1000,
        maxDrawingBytes: 4096n,
        random: (length) => new Uint8Array(length),
        read: (crate) => {
          loaded.push(crate);
          return Promise.reject(new Error("no disk"));
        },
        templates: [
          {
            codeHash: "a".repeat(64),
            crate: "game-rewards",
            version: "1.0.0",
          },
          {
            codeHash: "b".repeat(64),
            crate: "milestone-collectible",
            version: "1.0.0",
          },
        ],
      }),
    ]).port(chain, "builder");
    await expect(withAdministration.build(intent, funding)).rejects.toThrow(
      "no disk",
    );
    expect(loaded).toEqual(["game-rewards"]);
  });
});

describe("a step's template code", () => {
  const build = (maxCodeBytes: number) =>
    createConfiguredRegistry([configured(administration(maxCodeBytes))])
      .port(chain, "builder")
      .build(publish, feeCeiling(configured(), 1000n));

  it("is refused above the size limit, even with the right hash", async () => {
    await expect(build(10)).rejects.toThrow(/not the code/u);
  });

  it("goes on to the node within the limit", async () => {
    await expect(build(1000)).rejects.not.toThrow(/not the code/u);
  });
});

describe("a node that stays silent", () => {
  it("is given up on after the configured time", async () => {
    const slow = configured();
    const observer = createConfiguredRegistry([
      {
        ...slow,
        adapter: {
          kind: "bitcoin-alkanes",
          settings: {
            ...settings(null),
            rpc: { ...settings(null).rpc, timeoutMs: 1 },
          },
        },
      },
    ]).port(chain, "observer");
    await expect(
      observer.observe({ chain, id: "a".repeat(64) }),
    ).rejects.toThrow();
  });
});

describe("the fee ceiling", () => {
  it("is in the chain's own currency", () => {
    expect(feeCeiling(configured(), 25_000n)).toEqual({
      maxFee: {
        asset: { chain, id: "btc", kind: "native" },
        baseUnits: 25_000n,
      },
    });
  });
});
