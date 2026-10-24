import { join } from "node:path";

import { cacheIndexing } from "@ador/chain/indexing";
import { InvalidAddressError, type AddressBalance } from "@ador/chain/ports";
import {
  createConfiguredRegistry,
  feeCeiling,
  type ConfiguredChain,
  type FetchLike,
  type GetLike,
} from "@ador/chain/configured";
import {
  chainRefSchema,
  type ChainConfig,
  type ChainRef,
  type FeeRate,
  type FundingPolicy,
  type IndexingStatus,
} from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";

import { betaChain, type BetaChain } from "./chains.ts";
import { defaultFeeTargetBlocks, rewardsPolicy } from "./rewards-policy.ts";

// What the process provides, so a test can stand in for the network, the clock and the disk.
export interface RewardsPlatform {
  readonly fetch: FetchLike;
  // A plain GET, for the public fee source.
  readonly get: GetLike;
  readonly now: () => Date;
  readonly random: (length: number) => Uint8Array;
  readonly readFile: (path: string) => Promise<Uint8Array>;
}

// The six things claims and staff administration use on a chain, each reached through the registry's neutral ports.
type RewardsPorts = ReturnType<typeof portsOf>;

// The rewards chain as the games' claims and staff administration see it: the ports they use on a chain, and the most a step may pay.
export interface RewardsChain {
  chain(chain: ChainRef): {
    readonly funding: FundingPolicy;
    readonly ports: RewardsPorts;
  } | null;
  // The chain as anyone may see how far its indexer has read: its name, and the reading (which rejects where the node cannot be asked).
  readonly followed: {
    // Whether this is an address on the chain, in its notation; nothing is looked up for one that is not.
    accepts(address: string): boolean;
    // What an address holds on the chain (see `ChainObserver.balance`).
    balance(address: string): Promise<AddressBalance>;
    readonly displayName: string;
    // What the chain's fee market quotes for each block target.
    feeRates(targets: readonly number[]): Promise<readonly FeeRate[]>;
    indexing(): Promise<IndexingStatus>;
    // The most one step may pay in fees, in satoshis.
    readonly maxFeeSats: number;
  };
}

// The chain's record: every operation held to the confirmations decided for the beta's test network, and the gate the policy states.
// `beta` is the deployment's chain unless a test names another.
export function chainConfig(beta: BetaChain = betaChain): ChainConfig {
  const finality = {
    kind: "confirmations",
    required: rewardsPolicy.testChainConfirmations,
  } as const;
  const option = beta.chain;
  return {
    chainId: option.chainId,
    confirmations: {
      deploy: finality,
      mint: finality,
      "mint-milestone": finality,
      "publish-template": finality,
      "define-milestone": finality,
      "set-claims-paused": finality,
      transfer: finality,
    },
    displayName: option.displayName,
    enabled: true,
    family: option.family,
    releaseGate: rewardsPolicy.testChainReleaseGate,
    role: option.role,
  };
}

function configuredChain(
  environment: RewardsChainEnvironment,
  platform: RewardsPlatform,
  beta: BetaChain,
): ConfiguredChain {
  const directory = environment.templatesDirectory;
  return {
    adapter: {
      kind: "bitcoin-alkanes",
      settings: {
        administration:
          directory === null
            ? null
            : {
                maxCodeBytes: rewardsPolicy.maxTemplateCodeBytes,
                maxDrawingBytes: rewardsPolicy.maxDrawingBytes,
                random: platform.random,
                read: (crate) =>
                  platform.readFile(join(directory, `${crate}.wasm`)),
                templates: rewardsPolicy.templates,
              },
        chain: chainRefSchema.parse(beta.chain.chainId),
        feeApi: {
          fetch: platform.get,
          timeoutMs: environment.rpcTimeoutMs,
          url: beta.feeApiUrl,
        },
        maxPreviewBytes: rewardsPolicy.maxPreviewBytes,
        network: beta.network,
        now: platform.now,
        rpc: {
          fetch: platform.fetch,
          headers: environment.rpcHeaders,
          timeoutMs: environment.rpcTimeoutMs,
          url: environment.rpcUrl,
        },
        transactions: {
          changeDustSats: rewardsPolicy.changeDustSats,
          claimOutputSats: rewardsPolicy.claimOutputSats,
          feeSpeeds: rewardsPolicy.feeSpeeds,
          feeTargetBlocks: defaultFeeTargetBlocks,
          lifetimeMs: rewardsPolicy.lifetimeMs,
          random: platform.random,
          templateSequence: rewardsPolicy.templateSequence,
        },
      },
    },
    config: chainConfig(beta),
  };
}

function portsOf(
  registry: ReturnType<typeof createConfiguredRegistry>,
  platform: RewardsPlatform,
  chain: ChainRef,
) {
  return {
    addressCodec: registry.port(chain, "addressCodec"),
    broadcaster: registry.port(chain, "broadcaster"),
    builder: registry.port(chain, "builder"),
    contracts: registry.port(chain, "contracts"),
    // Every page of the site shows how far the indexer has read, so the node is asked once in a while and not once a visitor.
    observer: cacheIndexing(registry.port(chain, "observer"), {
      now: platform.now,
      ttlMs: rewardsPolicy.indexingReadingMs,
    }),
    rewards: registry.port(chain, "rewards"),
  };
}

// The fee ceiling as a page is told it, a plain number of satoshis. One too large to be a plain number is a mistake in the
// settings, refused when the chain is made rather than told wrongly.
function ceilingSats(maxFeeSats: bigint): number {
  if (maxFeeSats > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("REWARDS_MAX_FEE_SATS is larger than a page can be told.");
  return Number(maxFeeSats);
}

// The rewards chain for a deployment's settings, or null where none is set. While the policy keeps the chain's release gate closed
// it is not offered at all, so nothing is built, sent or watched on it.
export function createRewardsChain(
  environment: RewardsChainEnvironment | null,
  platform: RewardsPlatform,
  beta: BetaChain = betaChain,
): RewardsChain | null {
  if (environment === null) return null;
  const served = chainRefSchema.parse(beta.chain.chainId);
  const configured = configuredChain(environment, platform, beta);
  const registry = createConfiguredRegistry([configured]);
  const ports = portsOf(registry, platform, served);
  const offered = registry.broadcastAllowed(served)
    ? { funding: feeCeiling(configured, environment.maxFeeSats), ports }
    : null;
  return {
    chain: (chain) => (chain === served ? offered : null),
    // Reading how far the indexer has come moves nothing, so it does not wait on the release gate that guards sending.
    followed: {
      accepts: (address) => {
        try {
          ports.addressCodec.parse(served, address);
          return true;
        } catch (error) {
          if (error instanceof InvalidAddressError) return false;
          throw error;
        }
      },
      balance: (address) => ports.observer.balance(served, address),
      displayName: configured.config.displayName,
      feeRates: (targets) => ports.observer.feeRates(served, targets),
      indexing: () => ports.observer.indexing(served),
      maxFeeSats: ceilingSats(environment.maxFeeSats),
    },
  };
}
