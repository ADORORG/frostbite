import { describe, expect, it } from "vitest";
import { feeSpeeds, type FundingPolicy } from "@ador/shared/chain";

import { createTransactionBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { createContractGateway } from "../../src/bitcoin-alkanes/contracts.ts";
import {
  assertTransactionOptions,
  feeTargetFor,
} from "../../src/bitcoin-alkanes/options.ts";
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
// The block targets the test options give each speed.
const targets = { fast: 3, lightning: 1, medium: 6, slow: 25 } as const;

describe("the block target a transaction is priced for", () => {
  it("is the speed's own target, or the usual one when no speed was chosen", () => {
    expect(feeTargetFor(options, undefined)).toBe(options.feeTargetBlocks);
    for (const speed of feeSpeeds)
      expect(feeTargetFor(options, speed)).toBe(targets[speed]);
  });

  it("is checked with the other options: a speed policy that is not ordered is refused", () => {
    expect(() =>
      assertTransactionOptions({
        ...options,
        feeSpeeds: {
          ...options.feeSpeeds,
          lightning: { approxMinutes: 15, targetBlocks: 25 },
        },
      }),
    ).toThrow("faster");
  });
});

describe("pricing a claim at the speed chosen", () => {
  function builder() {
    const asked: number[] = [];
    const node = fakeNode({
      feeRate: (target) => {
        asked.push(target);
        return Promise.resolve(2);
      },
      utxos: () => Promise.resolve([utxo(idA, 0, 100_000n)]),
    });
    const chains = new Map<typeof chain, ServedChain>([
      [chain, { network: "mainnet", node }],
    ]);
    return { asked, build: createTransactionBuilder(chains, options, family) };
  }

  it.each(feeSpeeds)(
    "asks the node for the rate of the %s target",
    async (speed) => {
      const { asked, build } = builder();
      await build.build({ ...intent, feeSpeed: speed }, funding);
      expect(asked).toEqual([targets[speed]]);
    },
  );

  it("asks for the usual target when no speed was chosen", async () => {
    const { asked, build } = builder();
    await build.build(intent, funding);
    expect(asked).toEqual([options.feeTargetBlocks]);
  });
});

describe("estimating a claim at the speed chosen", () => {
  it("prices the simulated claim at that speed's rate too", async () => {
    const asked: number[] = [];
    const node = fakeNode({
      feeRate: (target) => {
        asked.push(target);
        return Promise.resolve(2);
      },
      view: () =>
        Promise.resolve({ data: new Uint8Array(), fuelUsed: 1n, ok: true }),
    });
    const chains = new Map<typeof chain, ServedChain>([
      [chain, { network: "mainnet", node }],
    ]);
    const gateway = createContractGateway(chains, options);
    await gateway.simulate({ ...intent, feeSpeed: "lightning" });
    await gateway.simulate(intent);
    expect(asked).toEqual([1, options.feeTargetBlocks]);
  });
});

describe("pricing the staff's steps at the speed chosen", () => {
  it("takes the rate for the speed's target, and the usual target when none was chosen", async () => {
    const asked: number[] = [];
    const node = adminNode({
      feeRate: (target) => {
        asked.push(target);
        return Promise.resolve(2);
      },
    });
    await adminBuilder(node).build(
      { ...intents.pause, feeSpeed: "fast" },
      adminFunding,
    );
    await adminBuilder(node).build(
      { ...intents.defineNoDrawing, feeSpeed: "lightning" },
      adminFunding,
    );
    await adminBuilder(node).build(intents.pause, adminFunding);
    expect(asked).toEqual([3, 1, options.feeTargetBlocks]);
  });
});
