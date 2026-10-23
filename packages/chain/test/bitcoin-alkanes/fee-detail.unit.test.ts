import { describe, expect, it } from "vitest";
import { feeSpeeds, type FundingPolicy } from "@ador/shared/chain";

import { createTransactionBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { feeDetailFor } from "../../src/bitcoin-alkanes/options.ts";
import {
  adminBuilder,
  adminNode,
  funding as adminFunding,
  intents,
} from "../support/administration.ts";
import { fakeNode } from "../support/nodes.ts";
import {
  chain,
  family,
  idA,
  intent,
  options,
  utxo,
} from "../support/claims.ts";

const funding: FundingPolicy = {
  maxFee: { asset: nativeAsset(chain), baseUnits: 1_000_000n },
};

describe("how a fee came about", () => {
  it("names the speed chosen with its wait, and the rate", () => {
    expect(feeDetailFor(options, "slow", 1.5)).toEqual({
      approxMinutes: 250,
      satPerVb: 1.5,
      speed: "slow",
    });
  });

  it("names the speed the usual target stands for when none was chosen", () => {
    expect(feeDetailFor(options, undefined, 2)).toEqual({
      approxMinutes: 30,
      satPerVb: 2,
      speed: "fast",
    });
  });

  it("names no speed when the usual target is none of them", () => {
    expect(
      feeDetailFor({ ...options, feeTargetBlocks: 4 }, undefined, 2),
    ).toEqual({ satPerVb: 2 });
  });
});

describe("the fee detail on what a person is shown", () => {
  it.each(feeSpeeds)(
    "tells a claim's rate and the %s speed it was priced at",
    async (speed) => {
      const chains = new Map<typeof chain, ServedChain>([
        [
          chain,
          {
            network: "mainnet",
            node: fakeNode({
              feeRate: () => Promise.resolve(4.5),
              utxos: () => Promise.resolve([utxo(idA, 0, 100_000n)]),
            }),
          },
        ],
      ]);
      const built = await createTransactionBuilder(
        chains,
        options,
        family,
      ).build({ ...intent, feeSpeed: speed }, funding);
      expect(built.summary.feeDetail).toEqual({
        approxMinutes: options.feeSpeeds[speed].approxMinutes,
        satPerVb: 4.5,
        speed,
      });
    },
  );

  it("tells a staff step's rate and speed, for a plain step and for one with a drawing", async () => {
    const node = adminNode({ feeRate: () => Promise.resolve(3) });
    const plain = await adminBuilder(node).build(
      { ...intents.pause, feeSpeed: "medium" },
      adminFunding,
    );
    const drawn = await adminBuilder(node).build(
      { ...intents.defineNoDrawing, feeSpeed: "lightning" },
      adminFunding,
    );
    expect(plain.summary.feeDetail).toEqual({
      approxMinutes: 60,
      satPerVb: 3,
      speed: "medium",
    });
    expect(drawn.summary.feeDetail).toEqual({
      approxMinutes: 15,
      satPerVb: 3,
      speed: "lightning",
    });
  });
});
