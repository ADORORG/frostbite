import type { AssetRef, ChainRef } from "@ador/shared/chain";

import type { BitcoinNetwork } from "../bitcoin/address.ts";
import type { AlkanesNode } from "./node/node.ts";

// A chain this adapter serves: which Bitcoin network it is, and the node that answers for it. Which chain is which network and
// which node serves it come from configuration.
export interface ServedChain {
  readonly network: BitcoinNetwork;
  readonly node: AlkanesNode;
}

export class ChainNotServedError extends Error {
  readonly code = "chain-not-served";
  constructor(chain: ChainRef) {
    super(`Chain ${chain} is not served by this adapter.`);
    this.name = "ChainNotServedError";
  }
}

// Pairs each chain's network with the node that answers for it. The nodes must cover exactly the chains served: a chain without a
// node could not be read, and a node without a chain would never be asked.
export function serveChains(
  networks: ReadonlyMap<ChainRef, BitcoinNetwork>,
  nodes: ReadonlyMap<ChainRef, AlkanesNode>,
): ReadonlyMap<ChainRef, ServedChain> {
  const served = [...networks.keys()].sort();
  if (served.join() !== [...nodes.keys()].sort().join()) {
    throw new Error(
      "The nodes must cover exactly the chains the adapter serves.",
    );
  }
  const chains = new Map<ChainRef, ServedChain>();
  for (const [chain, network] of networks) {
    const node = nodes.get(chain);
    if (node !== undefined) chains.set(chain, { network, node });
  }
  return chains;
}

export function servedChain(
  chains: ReadonlyMap<ChainRef, ServedChain>,
  chain: ChainRef,
): ServedChain {
  const found = chains.get(chain);
  if (found === undefined) throw new ChainNotServedError(chain);
  return found;
}

// Bitcoin itself, in satoshis: what fees are paid in.
export function nativeAsset(chain: ChainRef): AssetRef {
  return { chain, id: "btc", kind: "native" };
}
