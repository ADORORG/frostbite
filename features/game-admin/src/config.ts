import type { StatusPolling } from "@frostbite/feature-chain-status/api";
import type { AdminChainPorts, RewardsPlan } from "@frostbite/game-admin";
import type { DrawingPolicy } from "@frostbite/milestone-art";
import type {
  ChainRef,
  DelayPolicy,
  FeeSpeed,
  FundingPolicy,
} from "@frostbite/shared/chain";

// What the platform needs, beyond a game's manifest, to administer its rewards contract: a chain it can build, send and watch
// transactions on, what it has decided about publishing templates and creating contracts, and the limits a milestone's drawing is
// held to. Where a template or a game's contract is on the chain is not configuration: it is on record once the step that put it
// there completed.
export interface GameAdminConfig {
  // The chain's ports and the most a step may cost in fee, or null where the platform cannot take steps.
  chain(chain: ChainRef): {
    readonly funding: FundingPolicy;
    readonly ports: AdminChainPorts;
  } | null;
  // The time the service and its log use; production leaves it out (the real clock).
  readonly clock?: () => Date;
  // When a step's wait is called delayed (see `rewardsPolicy.delay`).
  readonly delay: DelayPolicy;
  // Where a transaction is shown on a block explorer, with `{id}` where its id goes, so staff can follow a step they sent.
  readonly explorerTxUrl: string;
  // The speed a step is offered at first, and how often the page asks the chain what each speed costs (milliseconds).
  readonly fees: {
    readonly defaultSpeed: FeeSpeed;
    readonly polling: StatusPolling;
  };
  // The chain templates are published on, the templates that may be, which a game and its collectibles are made from, and the most
  // a game's contract may be created to accept.
  readonly rewards: RewardsPlan;
  // The platform's fee on milestone claims: the most staff may set it to, in the chain's smallest unit.
  readonly platformFee: { readonly maximumSats: bigint };
  // The connected wallets that may sign steps from the page (LaserEyes provider ids). A wallet is on this list because the
  // deployment has decided to trust it with this, not because it happens to be installed.
  readonly signingWallets: readonly string[];
  // The rest of the sanitiser's limits; the byte limit is each contract's own (what it was created to accept).
  readonly drawingLimits: Omit<DrawingPolicy, "maxBytes">;
}
