import { describe, expect, it } from "vitest";
import { chainRefSchema } from "@ador/shared/chain";

import { portCapabilities } from "../../src/adapter.ts";
import { createBitcoinAlkanesAdapter } from "../../src/bitcoin-alkanes/adapter.ts";
import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";

const mainnet = chainRefSchema.parse("bip122:000000000019d6689c085ae165831e93");
const signet = chainRefSchema.parse("bip122:00000008819873e925422c1ff0f99f7c");
const node: AlkanesNode = {
  bytecode: () => Promise.resolve(null),
  height: () => Promise.resolve(1),
  view: () => Promise.resolve({ error: "none", ok: false }),
};

describe("the bitcoin-alkanes adapter with reads", () => {
  const networks = new Map([[mainnet, "mainnet" as const]]);

  it("declares the rewards reader and provides it when nodes are given", () => {
    const adapter = createBitcoinAlkanesAdapter(networks, {
      maxPreviewBytes: 8192,
      nodes: new Map([[mainnet, node]]),
    });
    expect(adapter.capabilities).toEqual(
      new Set([portCapabilities.addressCodec, portCapabilities.rewards]),
    );
    expect(Object.keys(adapter.ports).sort()).toEqual([
      "addressCodec",
      "rewards",
    ]);
  });

  it("stays an address codec only without nodes", () => {
    const adapter = createBitcoinAlkanesAdapter(networks);
    expect(adapter.capabilities).toEqual(
      new Set([portCapabilities.addressCodec]),
    );
    expect(Object.keys(adapter.ports)).toEqual(["addressCodec"]);
  });

  it("refuses nodes that do not cover exactly the chains it serves", () => {
    const two = new Map([
      [mainnet, "mainnet" as const],
      [signet, "signet" as const],
    ]);
    expect(() =>
      createBitcoinAlkanesAdapter(two, {
        maxPreviewBytes: 1,
        nodes: new Map([[mainnet, node]]),
      }),
    ).toThrow("cover exactly");
    expect(() =>
      createBitcoinAlkanesAdapter(networks, {
        maxPreviewBytes: 1,
        nodes: new Map([
          [mainnet, node],
          [signet, node],
        ]),
      }),
    ).toThrow("cover exactly");
  });
});
