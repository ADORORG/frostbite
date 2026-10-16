import {
  chainFamilyIdSchema,
  chainNamespace,
  type ChainRef,
} from "@ador/shared/chain";

import { portCapabilities, type ChainAdapter } from "../adapter.ts";
import {
  validateBitcoinAddress,
  type BitcoinNetwork,
} from "../bitcoin/address.ts";
import {
  InvalidAddressError,
  type AddressCodec,
  type ChainPorts,
} from "../ports.ts";
import type { AlkanesNode } from "./node/node.ts";
import { createRewardsReader, type RewardsChain } from "./rewards.ts";

// CAIP-2 namespace for Bitcoin chains (https://namespaces.chainagnostic.org/bip122/caip2).
const bitcoinNamespace = "bip122";

// Recorded on every chain record this adapter touches (ADR-017 section 7); bump on behavior change.
export const bitcoinAlkanesAdapterVersion = "0.1.0";

export const bitcoinAlkanesFamily =
  chainFamilyIdSchema.parse("bitcoin-alkanes");

// What turns reads on. Without it the adapter provides only the address codec.
export interface BitcoinAlkanesReads {
  // The node that serves each chain; the keys must be the chains the adapter serves.
  readonly nodes: ReadonlyMap<ChainRef, AlkanesNode>;
  readonly maxPreviewBytes: number;
}

// The `bitcoin-alkanes` adapter as it stands: the address codec, and the rewards reader when nodes are given. Simulation,
// construction, broadcast, and observation arrive with the mint tasks; until then the adapter declares only what it provides,
// so a feature that needs more fails at boot.
//
// Which CAIP-2 chain is which Bitcoin network comes from validated configuration; no chain
// identifier is hard-coded here.
export function createBitcoinAlkanesAdapter(
  networks: ReadonlyMap<ChainRef, BitcoinNetwork>,
  reads?: BitcoinAlkanesReads,
): ChainAdapter {
  if (networks.size === 0) {
    throw new Error("The bitcoin-alkanes adapter needs at least one chain.");
  }
  for (const chain of networks.keys()) {
    if (chainNamespace(chain) !== bitcoinNamespace) {
      throw new Error(`Chain ${chain} is not a ${bitcoinNamespace} chain.`);
    }
  }

  const addressCodec: AddressCodec = {
    parse: (chain, text) => {
      const network = networks.get(chain);
      if (network === undefined) {
        throw new InvalidAddressError(
          `Chain ${chain} is not served by this adapter.`,
        );
      }
      const result = validateBitcoinAddress(text, network);
      if (!result.ok) {
        throw new InvalidAddressError(
          `Not a valid ${network} address: ${result.code}.`,
        );
      }
      return { chain, value: result.value.address };
    },
  };

  const rewards =
    reads === undefined ? undefined : rewardsReader(networks, reads);
  const ports: Partial<ChainPorts> = {
    addressCodec,
    ...(rewards === undefined ? {} : { rewards }),
  };
  return {
    capabilities: new Set([
      portCapabilities.addressCodec,
      ...(rewards === undefined ? [] : [portCapabilities.rewards]),
    ]),
    family: bitcoinAlkanesFamily,
    ports,
    supports: (chain) => networks.has(chain),
    testOnly: false,
    version: bitcoinAlkanesAdapterVersion,
  };
}

function rewardsReader(
  networks: ReadonlyMap<ChainRef, BitcoinNetwork>,
  reads: BitcoinAlkanesReads,
) {
  const served = [...networks.keys()].sort();
  const nodes = [...reads.nodes.keys()].sort();
  if (served.join() !== nodes.join()) {
    throw new Error(
      "The nodes must cover exactly the chains the adapter serves.",
    );
  }
  const chains = new Map<ChainRef, RewardsChain>();
  for (const [chain, network] of networks) {
    const node = reads.nodes.get(chain);
    if (node === undefined) continue;
    chains.set(chain, { network, node });
  }
  return createRewardsReader({
    chains,
    maxPreviewBytes: reads.maxPreviewBytes,
  });
}
