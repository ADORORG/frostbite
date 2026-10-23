import { chainRefSchema } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import type { ServedChain } from "../../src/bitcoin-alkanes/chains.ts";
import type { AlkanesNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { createRpcNode } from "../../src/bitcoin-alkanes/node/node.ts";
import { createObserver } from "../../src/bitcoin-alkanes/observer.ts";
import { chain, idA, idB, options, utxo } from "../support/claims.ts";
import { fakeNode } from "../support/nodes.ts";
import { scriptedRpc } from "../support/rpc.ts";

const estimates = { "1": 9, "3": 5, "6": 3, "25": 1.009, "144": 0.495 };

describe("the fee market through the node", () => {
  it("answers each target with the nearest estimate at or above it, from one look", async () => {
    const { calls, rpc } = scriptedRpc({ "esplora_fee-estimates": estimates });
    expect(await createRpcNode(rpc).feeRates([1, 3, 6, 25])).toEqual([
      { satPerVb: 9, targetBlocks: 1 },
      { satPerVb: 5, targetBlocks: 3 },
      { satPerVb: 3, targetBlocks: 6 },
      { satPerVb: 1.009, targetBlocks: 25 },
    ]);
    expect(calls).toHaveLength(1);
    // A target between two estimates takes the one for more blocks, which is the cheaper and never a faster one than asked for.
    expect(await createRpcNode(rpc).feeRates([4, 30])).toEqual([
      { satPerVb: 3, targetBlocks: 4 },
      { satPerVb: 0.495, targetBlocks: 30 },
    ]);
  });

  it("stops, rather than guess, when the node has no estimate that far out or answers nonsense", async () => {
    await expect(
      createRpcNode(
        scriptedRpc({ "esplora_fee-estimates": { "1": 9 } }).rpc,
      ).feeRates([1, 6]),
    ).rejects.toThrow("no fee estimate");
    await expect(
      createRpcNode(
        scriptedRpc({ "esplora_fee-estimates": { "1": 0, x: 4, "2": "9" } })
          .rpc,
      ).feeRates([1]),
    ).rejects.toThrow("no fee estimate");
  });

  it("keeps the single rate the builder asks for", async () => {
    const node = createRpcNode(
      scriptedRpc({ "esplora_fee-estimates": estimates }).rpc,
    );
    expect(await node.feeRate(3)).toBe(5);
    await expect(node.feeRate(1_000)).rejects.toThrow("no fee estimate");
  });
});

const served = (utxos: AlkanesNode["utxos"]) =>
  new Map<typeof chain, ServedChain>([
    [chain, { network: "mainnet", node: fakeNode({ utxos }) }],
  ]);

describe("what an address holds", () => {
  it("separates what can be spent from what is waiting for its first confirmation", async () => {
    const observer = createObserver(
      served(async () => [
        utxo(idA, 0, 5_000n),
        { ...utxo(idB, 0, 7_000n), confirmed: false },
        utxo(idB, 1, 300n),
        { ...utxo(idA, 1, 20n), confirmed: false },
      ]),
      options,
    );
    expect(await observer.balance(chain, "tb1qexample")).toEqual({
      confirmed: 5_300n,
      pending: 7_020n,
    });
  });

  it("is nothing for an address with no outputs, and refuses a chain it does not serve", async () => {
    const observer = createObserver(
      served(async () => []),
      options,
    );
    expect(await observer.balance(chain, "tb1qexample")).toEqual({
      confirmed: 0n,
      pending: 0n,
    });
    await expect(
      observer.balance(
        chainRefSchema.parse("bip122:ffffffffffffffffffffffffffffffff"),
        "tb1qexample",
      ),
    ).rejects.toThrow();
  });

  it("asks the served chain's node for the rates", async () => {
    const observer = createObserver(
      new Map<typeof chain, ServedChain>([
        [
          chain,
          {
            network: "mainnet",
            node: fakeNode({
              feeRates: async (targets) =>
                targets.map((target) => ({
                  satPerVb: 2,
                  targetBlocks: target,
                })),
            }),
          },
        ],
      ]),
      options,
    );
    expect(await observer.feeRates(chain, [3])).toEqual([
      { satPerVb: 2, targetBlocks: 3 },
    ]);
  });
});
