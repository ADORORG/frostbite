import { InvalidAddressError } from "@frostbite/chain/ports";
import {
  afterBroadcast,
  afterObservation,
  indexed,
  isObservable,
  moveTo,
  signedOf,
  type Address,
  type FeeSpeed,
  type SignedTransaction,
  type UnsignedTransaction,
} from "@frostbite/shared/chain";

import { claimFee } from "./claim-fee.ts";
import { buildFailure, contractRefusal } from "./start-failures.ts";
import { createClaimViewer } from "./claim-steps.ts";
import { createPictureReader } from "./minted-picture.ts";
import type { ClaimChange, StoredClaim } from "./repository.ts";
import type {
  ClaimChainPorts,
  ClaimView,
  GameClaimsDependencies,
  MintedClaim,
  RefreshClaimResult,
  StartClaimResult,
  SubmitClaimResult,
} from "./types.ts";

export function createGameClaimsService(dependencies: GameClaimsDependencies) {
  const {
    clock,
    earned,
    funding,
    game,
    newId,
    platformFee,
    ports,
    report,
    repository,
  } = dependencies;
  const viewer = createClaimViewer(dependencies);
  const readPicture = createPictureReader({ ports, repository });

  // Sends a signed claim to the network, once; asking again sends the same bytes and the network gives the same id.
  async function broadcast(
    userId: string,
    claim: StoredClaim,
    chain: ClaimChainPorts,
  ): Promise<StoredClaim | null> {
    const signed = signedOf(claim);
    if (signed === null) return claim;
    const outcome = await chain.broadcaster.broadcast(signed);
    const change: ClaimChange | null = afterBroadcast(outcome);
    if (change === null) return claim;
    return repository.update(userId, claim.id, moveTo("signed", change));
  }

  return {
    // A player asks to claim a milestone they earned, with the wallet they will sign with. The answer is the claim in progress
    // if there is one (asking again changes nothing), or a new one with the transaction built and the summary to show.
    async start(input: {
      // How fast the player wants the claim confirmed; absent, the chain's usual speed.
      readonly feeSpeed?: FeeSpeed | undefined;
      readonly gameId: string;
      readonly milestoneId: string;
      readonly userId: string;
      // The address of the wallet that will sign, as the page gives it: parsed for the game's chain here.
      readonly wallet: string;
    }): Promise<StartClaimResult> {
      const { feeSpeed, gameId, milestoneId, userId, wallet } = input;
      const current = await game(gameId);
      const limit = current?.limits.get(milestoneId);
      if (current === null || limit === undefined)
        return { code: "not-claimable", ok: false };
      if (current.contract === null) return { code: "unavailable", ok: false };
      const chain = ports(current.chain);
      if (chain === null) return { code: "unavailable", ok: false };
      let sender: Address;
      try {
        sender = chain.addressCodec.parse(current.chain, wallet);
      } catch (error) {
        if (error instanceof InvalidAddressError)
          return { code: "wrong-chain", ok: false };
        throw error;
      }
      if (!(await earned(userId, gameId, milestoneId)))
        return { code: "not-earned", ok: false };

      let fee: Awaited<ReturnType<typeof claimFee>>;
      try {
        fee = await claimFee(platformFee, current.chain, chain);
      } catch (error) {
        report?.({ error, step: "start" });
        return { code: "unavailable", ok: false };
      }
      const intent = {
        chain: current.chain,
        contract: current.contract,
        ...(feeSpeed === undefined ? {} : { feeSpeed }),
        milestoneId,
        operation: "mint-milestone",
        ...(fee === null ? {} : { platformFee: fee.output }),
        sender,
      } as const;
      let unsigned: UnsignedTransaction;
      try {
        const simulated = await chain.contracts.simulate(intent);
        if (!simulated.ok)
          return { code: contractRefusal(simulated.reason), ok: false };
        unsigned = await chain.builder.build(intent, funding(current.chain));
      } catch (error) {
        const failure = buildFailure(error);
        if (!failure.expected) report?.({ error, step: "start" });
        return { code: failure.code, ok: false };
      }
      const result = await repository.create(
        {
          chain: current.chain,
          contract: current.contract,
          createdAt: clock(),
          expiresAt: new Date(unsigned.summary.expiresAt),
          gameId,
          id: newId(),
          milestoneId,
          platformFeeSats: fee?.sats ?? 0n,
          unsigned,
          userId,
          wallet: sender,
        },
        { limit },
      );
      if (result.kind === "limit-reached")
        return { code: "limit-reached", ok: false };
      return {
        claim: await viewer.one(result.claim),
        ok: true,
        resumed: result.kind === "in-progress",
      };
    },

    // The wallet signed what the player was shown. It is checked against what was built, kept, and sent to the network.
    // Sending the same signed claim again returns the claim as it is; a different one is refused.
    async submitSigned(input: {
      readonly claimId: string;
      readonly signed: SignedTransaction;
      readonly userId: string;
    }): Promise<SubmitClaimResult> {
      const { claimId, signed, userId } = input;
      const outcome: { refusal: SubmitClaimResult | null } = { refusal: null };
      const accepted = await repository.update(userId, claimId, (claim) => {
        if (claim.state !== "awaiting_signature") {
          outcome.refusal =
            claim.signedPayload === signed.payload
              ? null
              : { code: "not-awaiting-signature", ok: false };
          return null;
        }
        if (clock() >= claim.expiresAt) {
          outcome.refusal = { code: "expired", ok: false };
          return { state: "expired" };
        }
        const chain = ports(claim.chain);
        if (chain === null) {
          outcome.refusal = { code: "chain-unavailable", ok: false };
          return null;
        }
        const verified = chain.builder.verifySigned(claim.unsigned, signed);
        if (!verified.ok) {
          outcome.refusal = {
            code: "invalid-signature",
            ok: false,
            reason: verified.reason,
          };
          return null;
        }
        return { signedPayload: signed.payload, state: "signed" };
      });
      if (accepted === null) return { code: "not-found", ok: false };
      if (outcome.refusal !== null) return outcome.refusal;
      const chain = ports(accepted.chain);
      if (chain === null || accepted.state !== "signed")
        return { claim: await viewer.one(accepted), ok: true };
      try {
        const sent = await broadcast(userId, accepted, chain);
        return { claim: await viewer.one(sent ?? accepted), ok: true };
      } catch {
        return { code: "chain-unavailable", ok: false };
      }
    },

    // Looks at the chain once and moves the claim as far as the evidence allows. It is safe to call as often as wanted.
    async refresh(
      userId: string,
      claimId: string,
    ): Promise<RefreshClaimResult> {
      const claim = await repository.get(userId, claimId);
      if (claim === null) return { code: "not-found", ok: false };
      const chain = ports(claim.chain);
      if (chain === null) return { code: "chain-unavailable", ok: false };
      const done = async (held: StoredClaim): Promise<RefreshClaimResult> => ({
        claim: await viewer.one(held),
        ok: true,
      });
      try {
        if (claim.state === "signed")
          return done((await broadcast(userId, claim, chain)) ?? claim);
        if (claim.state === "awaiting_signature")
          return done(
            (await repository.update(userId, claimId, (held) =>
              held.state === "awaiting_signature" && clock() >= held.expiresAt
                ? { state: "expired" }
                : null,
            )) ?? claim,
          );
        if (claim.transactionId === null) return done(claim);
        const ref = { chain: claim.chain, id: claim.transactionId };
        if (claim.state === "confirmed") {
          const count = await chain.rewards.claimed(
            claim.contract,
            claim.wallet,
            claim.milestoneId,
          );
          const next = await repository.update(
            userId,
            claimId,
            count >= claim.expectedClaims
              ? moveTo("confirmed", { state: indexed })
              : () => null,
          );
          return done(next ?? claim);
        }
        if (!isObservable(claim.state)) return done(claim);
        const from = claim.state;
        const observation = await chain.observer.observe(ref);
        const next = afterObservation(from, observation);
        if (next === null) return done(claim);
        // The network shows what the transaction created once it is included: the first is the item the claim minted.
        const created = observation.created?.[0];
        const moved = await repository.update(
          userId,
          claimId,
          moveTo(
            from,
            created === undefined ? next : { ...next, collectibleId: created },
          ),
        );
        return done(moved ?? claim);
      } catch {
        return { code: "chain-unavailable", ok: false };
      }
    },

    async list(userId: string, gameId: string): Promise<readonly ClaimView[]> {
      return viewer.many(await repository.list(userId, gameId));
    },

    picture: (userId: string, claimId: string) => readPicture(userId, claimId),

    // How many players have minted each of a game's milestones (completed claims only), for a public page to say how rare one is.
    mintCounts: (gameId: string) => repository.completeCounts(gameId),

    // What the player has minted across games: only claims the network's records show complete.
    async minted(userId: string): Promise<readonly MintedClaim[]> {
      return (await repository.listComplete(userId)).flatMap((claim) =>
        claim.transactionId === null
          ? []
          : [
              {
                claimId: claim.id,
                gameId: claim.gameId,
                milestoneId: claim.milestoneId,
                mintedAt: claim.updatedAt.toISOString(),
                transactionId: claim.transactionId,
              },
            ],
      );
    },
  };
}

export type GameClaimsService = ReturnType<typeof createGameClaimsService>;
