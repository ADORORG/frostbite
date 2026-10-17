import { join } from "node:path";

import { cacheIndexing } from "@ador/chain/indexing";
import {
  createConfiguredRegistry,
  feeCeiling,
  type ConfiguredChain,
  type FetchLike,
} from "@ador/chain/configured";
import {
  chainRefSchema,
  type ChainConfig,
  type ChainRef,
  type FundingPolicy,
  type IndexingStatus,
} from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";

import { bitcoinSignetChainId, targetChains } from "./chains.ts";
import { rewardsPolicy } from "./rewards-policy.ts";

// What the process provides, so a test can stand in for the network, the clock and the disk.
export interface RewardsPlatform {
  readonly fetch: FetchLike;
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
    readonly displayName: string;
    indexing(): Promise<IndexingStatus>;
  };
}

const signet = chainRefSchema.parse(bitcoinSignetChainId);

function signetOption() {
  const option = targetChains.find(({ chainId }) => chainId === signet);
  if (option === undefined)
    throw new Error(`${signet} is not a configured chain.`);
  return option;
}

// The chain's record: every operation held to the confirmations decided for signet, and the gate the policy states.
export function chainConfig(): ChainConfig {
  const finality = {
    kind: "confirmations",
    required: rewardsPolicy.signetConfirmations,
  } as const;
  const option = signetOption();
  return {
    chainId: signet,
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
    releaseGate: rewardsPolicy.signetReleaseGate,
    role: option.role,
  };
}

function configuredChain(
  environment: RewardsChainEnvironment,
  platform: RewardsPlatform,
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
        chain: signet,
        maxPreviewBytes: rewardsPolicy.maxPreviewBytes,
        network: "signet",
        now: platform.now,
        rpc: {
          fetch: platform.fetch,
          timeoutMs: environment.rpcTimeoutMs,
          url: environment.rpcUrl,
        },
        transactions: {
          changeDustSats: rewardsPolicy.changeDustSats,
          claimOutputSats: rewardsPolicy.claimOutputSats,
          feeTargetBlocks: rewardsPolicy.feeTargetBlocks,
          lifetimeMs: rewardsPolicy.lifetimeMs,
        },
      },
    },
    config: chainConfig(),
  };
}

function portsOf(
  registry: ReturnType<typeof createConfiguredRegistry>,
  platform: RewardsPlatform,
) {
  return {
    addressCodec: registry.port(signet, "addressCodec"),
    broadcaster: registry.port(signet, "broadcaster"),
    builder: registry.port(signet, "builder"),
    contracts: registry.port(signet, "contracts"),
    // Every page of the site shows how far the indexer has read, so the node is asked once in a while and not once a visitor.
    observer: cacheIndexing(registry.port(signet, "observer"), {
      now: platform.now,
      ttlMs: rewardsPolicy.indexingReadingMs,
    }),
    rewards: registry.port(signet, "rewards"),
  };
}

// The rewards chain for a deployment's settings, or null where none is set. While the policy keeps the chain's release gate closed
// it is not offered at all, so nothing is built, sent or watched on it.
export function createRewardsChain(
  environment: RewardsChainEnvironment | null,
  platform: RewardsPlatform,
): RewardsChain | null {
  if (environment === null) return null;
  const configured = configuredChain(environment, platform);
  const registry = createConfiguredRegistry([configured]);
  const ports = portsOf(registry, platform);
  const offered = registry.broadcastAllowed(signet)
    ? { funding: feeCeiling(configured, environment.maxFeeSats), ports }
    : null;
  return {
    chain: (chain) => (chain === signet ? offered : null),
    // Reading how far the indexer has come moves nothing, so it does not wait on the release gate that guards sending.
    followed: {
      displayName: configured.config.displayName,
      indexing: () => ports.observer.indexing(signet),
    },
  };
}
