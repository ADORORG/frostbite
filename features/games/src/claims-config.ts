import type { ClaimChainPorts } from "@ador/game-claims";
import type { ChainRef, DelayPolicy, FundingPolicy } from "@ador/shared/chain";

// What the platform needs, beyond a game's manifest, to take a claim of one of its milestones: a chain it can build, send and watch
// transactions on. A chain with no adapter that can take claims answers `null`, and the page says claims are not available. The
// rewards contract of a game is not configuration: it is on record once the step that created it completed, and a game without one
// cannot be claimed from.
export interface GameClaimsConfig {
  // The chain's ports and the most a player's claim may cost in fee, or null where the platform cannot take claims.
  chain(chain: ChainRef): {
    readonly funding: FundingPolicy;
    readonly ports: ClaimChainPorts;
  } | null;
  // The time the claims service and its records use. Production leaves it out (the real clock); a test that drives a
  // simulated chain on its own clock passes that clock, so a claim's expiry is judged on the clock that set it.
  readonly clock?: () => Date;
  // When a claim's wait is called delayed (see `rewardsPolicy.delay`).
  readonly delay: DelayPolicy;
}
