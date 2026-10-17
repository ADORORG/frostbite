import { describe, expect, it } from "vitest";

import type { ServedChain } from "../../src/bitcoin-alkanes/chains.ts";
import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { createObserver } from "../../src/bitcoin-alkanes/observer.ts";
import { fakeNode } from "../support/nodes.ts";
import { chain, options } from "../support/claims.ts";

const served = (node: AlkanesNode) =>
  new Map<typeof chain, ServedChain>([[chain, { network: "mainnet", node }]]);
const observer = (node: Partial<AlkanesNode>) =>
  createObserver(served(fakeNode(node)), options);
const ref = { chain, id: "aa".repeat(32) };

describe("observing what a call created", () => {
  it("lists the contracts the call created, once it ran, in the chain's own notation", async () => {
    const node = (outcome: "failure" | "success", created: number[]) => ({
      indexedHeight: () => Promise.resolve(100),
      tip: () => Promise.resolve({ hash: "cc".repeat(32), height: 100 }),
      trace: () =>
        Promise.resolve({
          created: created.map((tx) => ({ block: 2n, tx: BigInt(tx) })),
          outcome,
        }),
      transaction: () =>
        Promise.resolve({
          blockHash: "bb".repeat(32),
          blockHeight: 100,
          confirmed: true,
          outputs: 2,
        }),
    });
    expect(
      (await observer(node("success", [1, 2])).observe(ref)).created,
    ).toEqual(["2:1", "2:2"]);
    expect(
      (await observer(node("success", [])).observe(ref)).created,
    ).toBeUndefined();
    expect(
      (await observer(node("failure", [1])).observe(ref)).created,
    ).toBeUndefined();
  });
});
