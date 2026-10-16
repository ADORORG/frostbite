import { type FundingPolicy } from "@ador/shared/chain";

import { createClaimBuilder } from "../../src/bitcoin-alkanes/builder.ts";
import {
  nativeAsset,
  type ServedChain,
} from "../../src/bitcoin-alkanes/chains.ts";
import { fakeNode } from "./nodes.ts";
import { chain, claimIntent, family, idA, options, utxo } from "./claims.ts";

export const funding: FundingPolicy = {
  maxFee: { asset: nativeAsset(chain), baseUnits: 10_000n },
};
export const chains = new Map<typeof chain, ServedChain>([
  [
    chain,
    {
      network: "mainnet",
      node: fakeNode({
        feeRate: () => Promise.resolve(2),
        utxos: () => Promise.resolve([utxo(idA, 0, 100_000n)]),
      }),
    },
  ],
]);
export const builder = createClaimBuilder(chains, options, family);
export const build = () => builder.build(claimIntent, funding);
