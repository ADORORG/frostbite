import type { AdminChainPorts, RewardsPlan } from "@ador/game-admin";
import type { DrawingPolicy } from "@ador/milestone-art";
import type { ChainRef, FundingPolicy } from "@ador/shared/chain";

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
  // The chain templates are published on, the templates that may be, which a game and its collectibles are made from, and the most
  // a game's contract may be created to accept.
  readonly rewards: RewardsPlan;
  // The rest of the sanitiser's limits; the byte limit is each contract's own (what it was created to accept).
  readonly drawingLimits: Omit<DrawingPolicy, "maxBytes">;
}
