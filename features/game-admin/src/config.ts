import type { AdminChainPorts } from "@ador/game-admin";
import type { DrawingPolicy } from "@ador/milestone-art";
import type { ChainRef, ContractRef, FundingPolicy } from "@ador/shared/chain";

// What the platform needs, beyond a game's manifest, to administer its rewards contract: the contract deployed for it, a chain it can
// build, send and watch transactions on, and the limits a milestone's drawing is held to. Both the contract and the chain are
// configuration, so a deployment that has deployed nothing offers nothing, and the page says so.
export interface GameAdminConfig {
  // The chain's ports and the most a step may cost in fee, or null where the platform cannot take steps.
  chain(chain: ChainRef): {
    readonly funding: FundingPolicy;
    readonly ports: AdminChainPorts;
  } | null;
  // The time the service and its log use; production leaves it out (the real clock).
  readonly clock?: () => Date;
  // The rewards contract deployed for each game, by game id.
  readonly contracts: ReadonlyMap<string, ContractRef>;
  // The largest drawing each game's contract was initialised to accept (`max_art_bytes`), by game id.
  readonly maxDrawingBytes: ReadonlyMap<string, bigint>;
  // The rest of the sanitiser's limits; the byte limit above is each contract's own.
  readonly drawingLimits: Omit<DrawingPolicy, "maxBytes">;
}
