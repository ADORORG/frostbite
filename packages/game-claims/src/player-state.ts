import { transactionStates } from "@ador/shared/chain";

import type { ClaimState } from "./repository.ts";

// Where a claim stands as the player and the game are told (the SDK's `claimStates`), never saying "minted" before the chain's
// indexed state agrees: waiting for the wallet's signature; sent and not yet confirmed; confirmed on chain; complete (the
// indexed state agrees); failed (rejected, or included and reverted); or lapsed before it was signed.
export type PlayerClaimState =
  | "awaiting-signature"
  | "claimed"
  | "complete"
  | "expired"
  | "failed"
  | "pending";

// Written out for every state of the lifecycle, so a state added there fails the type check here until it is placed.
const placed: Readonly<Record<ClaimState, PlayerClaimState>> = {
  awaiting_signature: "awaiting-signature",
  broadcast_accepted: "pending",
  broadcast_rejected: "failed",
  broadcast_unknown: "pending",
  complete: "complete",
  confirmed: "claimed",
  constructed: "awaiting-signature",
  expired: "expired",
  indexed_failure: "failed",
  indexed_success: "claimed",
  pending: "pending",
  reconciled: "claimed",
  signed: "pending",
  simulated: "awaiting-signature",
};

export const playerClaimState = (state: ClaimState): PlayerClaimState =>
  placed[state];

// The states the lifecycle has, so a test can hold the table above to them.
export const lifecycleStates: readonly ClaimState[] = [
  ...transactionStates,
  "expired",
];
