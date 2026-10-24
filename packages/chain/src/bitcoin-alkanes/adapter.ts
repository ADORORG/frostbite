import {
  chainFamilyIdSchema,
  chainNamespace,
  type ChainRef,
} from "@ador/shared/chain";

import { portCapabilities, portNames, type ChainAdapter } from "../adapter.ts";
import {
  validateBitcoinAddress,
  type BitcoinNetwork,
} from "../bitcoin/address.ts";
import {
  InvalidAddressError,
  type AddressCodec,
  type ChainPorts,
} from "../ports.ts";
import { createBroadcaster } from "./broadcaster.ts";
import { serveChains } from "./chains.ts";
import type { AdminOptions } from "./admin/templates.ts";
import { createTransactionBuilder } from "./builder.ts";
import { createContractGateway } from "./contracts.ts";
import type { AlkanesNode } from "./node/node.ts";
import { createObserver } from "./observer.ts";
import type { TransactionOptions } from "./options.ts";
import { createRewardsReader } from "./rewards.ts";

// What a caller needs to wire the adapter to a node.
export { createRpcNode, type AlkanesNode } from "./node/node.ts";
export { createFeeApi, type FeeApi, type GetLike } from "./node/fee-api.ts";
export {
  createJsonRpc,
  type FetchLike,
  type JsonRpcOptions,
} from "./node/transport.ts";
export { packCode, sha256Hex } from "./admin/data.ts";
export type { TransactionOptions } from "./options.ts";
export { templateEntries, type TemplateSetting } from "./settings.ts";
export {
  templateKey,
  type AdminOptions,
  type TemplateEntry,
} from "./admin/templates.ts";

// CAIP-2 namespace for Bitcoin chains (https://namespaces.chainagnostic.org/bip122/caip2).
const bitcoinNamespace = "bip122";

// Recorded on every chain record this adapter touches (ADR-017 section 7); bump on behavior change.
export const bitcoinAlkanesAdapterVersion = "0.2.0";

export const bitcoinAlkanesFamily =
  chainFamilyIdSchema.parse("bitcoin-alkanes");

// What turns the node-backed ports on. Without it the adapter provides only the address codec.
export interface BitcoinAlkanesNodes {
  readonly maxPreviewBytes: number;
  // The node that serves each chain; the keys must be the chains the adapter serves.
  readonly nodes: ReadonlyMap<ChainRef, AlkanesNode>;
  // When given, the adapter also builds, sends and watches milestone claims and simulates them; without it, reads only.
  readonly transactions?: TransactionOptions;
  // When given (with `transactions`), the builder also builds the staff's steps: publishing templates, creating games, defining
  // milestones and pausing. Without it the adapter refuses them.
  readonly administration?: AdminOptions;
}

// The `bitcoin-alkanes` adapter as it stands: the address codec; given nodes, the rewards reader; given transaction options too,
// the claim builder, broadcaster, observer and contract gateway. Deploying templates and administering a game (defining
// milestones, pausing) need the platform's own signer and arrive with it; the adapter declares only what it provides, so a
// feature that needs more fails at boot.
//
// Which CAIP-2 chain is which Bitcoin network comes from validated configuration; no chain
// identifier is hard-coded here.
export function createBitcoinAlkanesAdapter(
  networks: ReadonlyMap<ChainRef, BitcoinNetwork>,
  services?: BitcoinAlkanesNodes,
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

  const ports: Partial<ChainPorts> = {
    addressCodec,
    ...(services === undefined ? {} : nodePorts(networks, services)),
  };
  return {
    capabilities: new Set(
      portNames
        .filter((name) => ports[name] !== undefined)
        .map((name) => portCapabilities[name]),
    ),
    family: bitcoinAlkanesFamily,
    ports,
    supports: (chain) => networks.has(chain),
    testOnly: false,
    version: bitcoinAlkanesAdapterVersion,
  };
}

function nodePorts(
  networks: ReadonlyMap<ChainRef, BitcoinNetwork>,
  services: BitcoinAlkanesNodes,
): Partial<ChainPorts> {
  const chains = serveChains(networks, services.nodes);
  const rewards = createRewardsReader({
    chains,
    maxPreviewBytes: services.maxPreviewBytes,
  });
  const options = services.transactions;
  if (options === undefined) return { rewards };
  return {
    broadcaster: createBroadcaster(chains),
    builder: createTransactionBuilder(
      chains,
      options,
      bitcoinAlkanesFamily,
      services.administration,
    ),
    contracts: createContractGateway(chains, options),
    observer: createObserver(chains, options),
    rewards,
  };
}
