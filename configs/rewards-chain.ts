import { join } from "node:path";

import {
  createConfiguredRegistry,
  feeCeiling,
  type ConfiguredChain,
  type FetchLike,
  type TemplateSetting,
} from "@ador/chain/configured";
import {
  chainRefSchema,
  type ChainConfig,
  type ChainRef,
  type ContractRef,
  type FundingPolicy,
} from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";

import { bitcoinSignetChainId, targetChains } from "./chains.ts";
import { collectibleTemplate, rewardsPolicy } from "./rewards-policy.ts";

// What the process provides, so a test can stand in for the network, the clock and the disk.
export interface RewardsPlatform {
  readonly fetch: FetchLike;
  readonly now: () => Date;
  readonly random: (length: number) => Uint8Array;
  readonly readFile: (path: string) => Promise<Uint8Array>;
}

// The six things claims and staff administration use on a chain, each reached through the registry's neutral ports.
type RewardsPorts = ReturnType<typeof portsOf>;

// The rewards chain as the games' claims and staff administration see it: the ports they use on a chain, the contract deployed
// for each game and the drawing size it accepts.
export interface RewardsChain {
  chain(chain: ChainRef): {
    readonly funding: FundingPolicy;
    readonly ports: RewardsPorts;
  } | null;
  readonly contracts: ReadonlyMap<string, ContractRef>;
  readonly maxDrawingBytes: ReadonlyMap<string, bigint>;
}

const signet = chainRefSchema.parse(bitcoinSignetChainId);

function signetOption() {
  const option = targetChains.find(({ chainId }) => chainId === signet);
  if (option === undefined)
    throw new Error(`${signet} is not a configured chain.`);
  return option;
}

// The chain's record: every operation held to the confirmations decided for signet, and the gate as the deployment states it.
export function chainConfig(environment: RewardsChainEnvironment): ChainConfig {
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
    releaseGate: environment.releaseGate,
    role: option.role,
  };
}

// The templates the platform may publish, each with the Alkane the deployment publishes it at.
export function templateSettings(
  ids: Readonly<
    Record<(typeof rewardsPolicy.templates)[number]["crate"], string>
  >,
): TemplateSetting[] {
  return rewardsPolicy.templates.map((template) => ({
    ...template,
    alkane: ids[template.crate],
  }));
}

function configuredChain(
  environment: RewardsChainEnvironment,
  platform: RewardsPlatform,
): ConfiguredChain {
  const { templates } = environment;
  return {
    adapter: {
      kind: "bitcoin-alkanes",
      settings: {
        administration:
          templates === null
            ? null
            : {
                collectibleTemplate,
                maxCodeBytes: rewardsPolicy.maxTemplateCodeBytes,
                maxDrawingBytes: rewardsPolicy.defaultMaxDrawingBytes,
                random: platform.random,
                read: (crate) =>
                  platform.readFile(join(templates.directory, `${crate}.wasm`)),
                templates: templateSettings(templates.ids),
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
    config: chainConfig(environment),
  };
}

function portsOf(registry: ReturnType<typeof createConfiguredRegistry>) {
  return {
    addressCodec: registry.port(signet, "addressCodec"),
    broadcaster: registry.port(signet, "broadcaster"),
    builder: registry.port(signet, "builder"),
    contracts: registry.port(signet, "contracts"),
    observer: registry.port(signet, "observer"),
    rewards: registry.port(signet, "rewards"),
  };
}

// The rewards chain for a deployment's settings, or null where none is set. While the release gate is closed the chain is not
// offered at all, so nothing is built, sent or watched on it.
export function createRewardsChain(
  environment: RewardsChainEnvironment | null,
  platform: RewardsPlatform,
): RewardsChain | null {
  if (environment === null) return null;
  const configured = configuredChain(environment, platform);
  const registry = createConfiguredRegistry([configured]);
  const offered = registry.broadcastAllowed(signet)
    ? {
        funding: feeCeiling(configured, environment.maxFeeSats),
        ports: portsOf(registry),
      }
    : null;
  const { family } = signetOption();
  return {
    chain: (chain) => (chain === signet ? offered : null),
    contracts: new Map(
      [...environment.contracts].map(([game, { id }]) => [
        game,
        { chain: signet, family, id },
      ]),
    ),
    maxDrawingBytes: new Map(
      [...environment.contracts].map(([game, { maxDrawingBytes }]) => [
        game,
        maxDrawingBytes,
      ]),
    ),
  };
}
