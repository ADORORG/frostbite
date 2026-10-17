import {
  playerClaimState,
  type ClaimView,
  type GameClaimsService,
} from "@ador/game-claims";
import type { HttpOperation } from "@ador/http";
import { signedTransactionSchema } from "@ador/shared/chain";
import { unauthenticated } from "@ador/http/outcome";
import {
  listGameClaimsInputSchema,
  listGameClaimsResponseSchema,
  listGameClaimsRoute,
  refreshGameClaimInputSchema,
  refreshGameClaimResponseSchema,
  refreshGameClaimRoute,
  startGameClaimInputSchema,
  startGameClaimResponseSchema,
  startGameClaimRoute,
  submitGameClaimInputSchema,
  submitGameClaimResponseSchema,
  submitGameClaimRoute,
  type GameClaim,
  type GameClaimUnavailableReason,
  type ListGameClaimsInput,
  type ListGameClaimsResponse,
  type RefreshGameClaimInput,
  type RefreshGameClaimResponse,
  type StartGameClaimInput,
  type StartGameClaimResponse,
  type SubmitGameClaimInput,
  type SubmitGameClaimResponse,
} from "@ador/shared/games";

type Service = () => Promise<GameClaimsService>;

// A claim as the page is told of it: the player-facing state, the summary as plain text, and the transaction to sign only while
// the wallet is still to be asked. A claim's summary always names its milestone; one that does not is not a claim.
export function toWireClaim(view: ClaimView): GameClaim {
  const { milestone } = view.summary;
  if (milestone === undefined)
    throw new Error("A claim's summary names the milestone it claims.");
  return {
    delayed: view.delayed,
    failureReason: view.failureReason,
    gameId: view.gameId,
    id: view.id,
    milestoneId: view.milestoneId,
    sentAt: view.sentAt,
    state: playerClaimState(view.state),
    summary: {
      chain: view.summary.chain,
      contractId: milestone.contract.id,
      expiresAt: view.summary.expiresAt,
      fee: {
        asset: view.summary.fee.asset.id,
        baseUnits: view.summary.fee.baseUnits.toString(),
      },
      milestoneId: view.milestoneId,
      recipient: view.wallet.value,
    },
    toSign:
      view.toSign === null
        ? null
        : {
            chain: view.toSign.chain,
            family: view.toSign.family,
            format: view.toSign.format,
            payload: view.toSign.payload,
          },
    transactionId: view.transactionId,
  };
}

const unavailableReason = {
  "chain-unavailable": "unavailable",
  "limit-reached": "limit-reached",
  "not-claimable": "not-claimable",
  "not-earned": "not-earned",
  unavailable: "not-supported",
  "wrong-chain": "wrong-network",
  "would-fail": "unavailable",
} as const satisfies Record<string, GameClaimUnavailableReason>;

// Starts a claim for the signed-in player. The owner is the session, never a field of the request. A milestone that cannot be
// claimed right now is an answer ("unavailable", with why), not an error.
export function createStartGameClaimOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).start({
        gameId: input.gameId,
        milestoneId: input.milestoneId,
        userId: context.actorUserId,
        wallet: input.wallet,
      });
      return {
        ok: true,
        value: outcome.ok
          ? {
              claim: toWireClaim(outcome.claim),
              resumed: outcome.resumed,
              status: "started",
            }
          : { reason: unavailableReason[outcome.code], status: "unavailable" },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: startGameClaimInputSchema,
    outputSchema: startGameClaimResponseSchema,
    ...startGameClaimRoute,
  } satisfies HttpOperation<StartGameClaimInput, StartGameClaimResponse>;
}

// Takes what the wallet signed for one of the player's claims. A claim that is not the player's is "not-found", the same answer
// as one that does not exist.
export function createSubmitGameClaimOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).submitSigned({
        claimId: input.claimId,
        signed: signedTransactionSchema.parse(input.signed),
        userId: context.actorUserId,
      });
      return {
        ok: true,
        value: outcome.ok
          ? { claim: toWireClaim(outcome.claim), status: "submitted" }
          : { reason: outcome.code, status: "refused" },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: submitGameClaimInputSchema,
    outputSchema: submitGameClaimResponseSchema,
    ...submitGameClaimRoute,
  } satisfies HttpOperation<SubmitGameClaimInput, SubmitGameClaimResponse>;
}

// Looks at the chain once for one of the player's claims and answers how it stands. The page asks again until it is over.
export function createRefreshGameClaimOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).refresh(context.actorUserId, input.claimId);
      return {
        ok: true,
        value: outcome.ok
          ? { claim: toWireClaim(outcome.claim), status: "ok" }
          : { reason: outcome.code, status: "refused" },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: refreshGameClaimInputSchema,
    outputSchema: refreshGameClaimResponseSchema,
    ...refreshGameClaimRoute,
  } satisfies HttpOperation<RefreshGameClaimInput, RefreshGameClaimResponse>;
}

// The player's claims for a game, oldest first. It is a POST because this API's GET carries no query string.
export function createListGameClaimsOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const claims = await (
        await getService()
      ).list(context.actorUserId, input.gameId);
      return { ok: true, value: { claims: claims.map(toWireClaim) } } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: listGameClaimsInputSchema,
    outputSchema: listGameClaimsResponseSchema,
    ...listGameClaimsRoute,
  } satisfies HttpOperation<ListGameClaimsInput, ListGameClaimsResponse>;
}
