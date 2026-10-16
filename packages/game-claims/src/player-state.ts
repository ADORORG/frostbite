import { stageOf } from "@ador/shared/chain";

import type { ClaimState } from "./repository.ts";

// Where a claim stands as the player and the game are told (the SDK's `claimStates`): the lifecycle's stages, with the confirmed
// stage called "claimed" (confirmed on chain, the indexed state not yet agreeing).
export type PlayerClaimState =
  | "awaiting-signature"
  | "claimed"
  | "complete"
  | "expired"
  | "failed"
  | "pending";

export const playerClaimState = (state: ClaimState): PlayerClaimState => {
  const stage = stageOf(state);
  return stage === "confirmed" ? "claimed" : stage;
};
