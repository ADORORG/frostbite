import type { SignedTransaction, TransactionState } from "@ador/shared/chain";

import type { ClaimChange, StoredClaim } from "./repository.ts";
import type { ClaimView } from "./types.ts";
import { canMove } from "./transitions.ts";

export const toView = (claim: StoredClaim): ClaimView => ({
  expiresAt: claim.expiresAt.toISOString(),
  failureReason: claim.failureReason,
  gameId: claim.gameId,
  id: claim.id,
  milestoneId: claim.milestoneId,
  state: claim.state,
  summary: claim.unsigned.summary,
  toSign: claim.state === "awaiting_signature" ? claim.unsigned : null,
  transactionId: claim.transactionId,
  wallet: claim.wallet,
});

export const signedOf = (claim: StoredClaim): SignedTransaction | null =>
  claim.signedPayload === null
    ? null
    : {
        chain: claim.unsigned.chain,
        family: claim.unsigned.family,
        format: claim.unsigned.format,
        payload: claim.signedPayload,
      };

// A change is written only if the lifecycle allows the move from where the claim is now; otherwise nothing is written, so a
// step that arrives late (or twice) cannot move a claim backwards or sideways.
export const moveTo =
  (from: TransactionState, change: ClaimChange) =>
  (claim: StoredClaim): ClaimChange | null =>
    claim.state === from &&
    change.state !== "expired" &&
    canMove(from, change.state)
      ? change
      : null;
