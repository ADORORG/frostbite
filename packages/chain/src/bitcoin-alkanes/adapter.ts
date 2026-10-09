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
import { InvalidAddressError, type AddressCodec } from "../ports.ts";

// CAIP-2 namespace for Bitcoin chains (https://namespaces.chainagnostic.org/bip122/caip2).
const bitcoinNamespace = "bip122";

// Recorded on every chain record this adapter touches (ADR-017 section 7); bump on behavior change.
export const bitcoinAlkanesAdapterVersion = "0.1.0";

export const bitcoinAlkanesFamily =
  chainFamilyIdSchema.parse("bitcoin-alkanes");

// The `bitcoin-alkanes` adapter as it stands: the address codec. Reads, simulation, construction,
// broadcast, and observation arrive with the contract and mint tasks (W6, W7); until then the
// adapter declares only what it provides, so a feature that needs more fails at boot.
//
// Which CAIP-2 chain is which Bitcoin network comes from validated configuration; no chain
// identifier is hard-coded here.
export function createBitcoinAlkanesAdapter(
  networks: ReadonlyMap<ChainRef, BitcoinNetwork>,
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

  return {
    capabilities: new Set([portCapabilities.addressCodec]),
    family: bitcoinAlkanesFamily,
    ports: { addressCodec },
    supports: (chain) => networks.has(chain),
    testOnly: false,
    version: bitcoinAlkanesAdapterVersion,
  };
}
