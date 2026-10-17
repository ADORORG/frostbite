import { createDelayJudge, type IndexingPorts } from "@ador/chain/indexing";

import type { StoredClaim } from "./repository.ts";
import type { ClaimView, GameClaimsDependencies } from "./types.ts";

const toView = (claim: StoredClaim, delayed: boolean): ClaimView => ({
  delayed,
  expiresAt: claim.expiresAt.toISOString(),
  failureReason: claim.failureReason,
  gameId: claim.gameId,
  id: claim.id,
  milestoneId: claim.milestoneId,
  sentAt: claim.broadcastAt?.toISOString() ?? null,
  state: claim.state,
  summary: claim.unsigned.summary,
  toSign: claim.state === "awaiting_signature" ? claim.unsigned : null,
  transactionId: claim.transactionId,
  wallet: claim.wallet,
});

// How claims are told to a player or a page: each with whether its wait is delayed, judged against the chain's indexer as it is now.
export function createClaimViewer(
  dependencies: Pick<GameClaimsDependencies, "clock" | "delay"> & {
    readonly ports: IndexingPorts;
  },
) {
  const judge = createDelayJudge({
    now: dependencies.clock,
    ports: dependencies.ports,
    policy: dependencies.delay,
  });
  const many = async (claims: readonly StoredClaim[]): Promise<ClaimView[]> => {
    const delayed = await judge(claims);
    return claims.map((claim, index) => toView(claim, delayed[index] === true));
  };
  return {
    many,
    one: async (claim: StoredClaim): Promise<ClaimView> =>
      toView(claim, (await judge([claim]))[0] === true),
  };
}
