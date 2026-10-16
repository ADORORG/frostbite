import type { ClaimChainPorts } from "@ador/game-claims";
import type { ChainRef, ContractRef, FundingPolicy } from "@ador/shared/chain";

// What the platform needs, beyond a game's manifest, to take a claim of one of its milestones: the rewards contract deployed
// for the game, and a chain it can build, send and watch transactions on. A game with no contract cannot be claimed from; a chain
// with no adapter that can take claims answers `null`, and the page says claims are not available. Both are configuration, so
// a deployment that has deployed nothing offers nothing, and says so.
export interface GameClaimsConfig {
  // The chain's ports and the most a player's claim may cost in fee, or null where the platform cannot take claims.
  chain(chain: ChainRef): {
    readonly funding: FundingPolicy;
    readonly ports: ClaimChainPorts;
  } | null;
  // The rewards contract deployed for each game, by game id.
  readonly contracts: ReadonlyMap<string, ContractRef>;
  // The time the claims service and its records use. Production leaves it out (the real clock); a test that drives a
  // simulated chain on its own clock passes that clock, so a claim's expiry is judged on the clock that set it.
  readonly clock?: () => Date;
}
