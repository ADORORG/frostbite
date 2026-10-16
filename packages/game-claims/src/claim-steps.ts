import type { StoredClaim } from "./repository.ts";
import type { ClaimView } from "./types.ts";

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
