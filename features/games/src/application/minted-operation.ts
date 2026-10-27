import type { GameClaimsService } from "@ador/game-claims";
import type { HttpOperation } from "@ador/http";
import { unauthenticated } from "@ador/http/outcome";
import {
  getMintedPictureInputSchema,
  getMintedPictureResponseSchema,
  getMintedPictureRoute,
  listMintedMilestonesInputSchema,
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
  type GetMintedPictureInput,
  type GetMintedPictureResponse,
  type ListMintedMilestonesInput,
  type ListMintedMilestonesResponse,
} from "@ador/shared/games";

// What the signed-in player has minted across games, newest first. The owner is the session, never a field of the request.
export function createListMintedMilestonesOperation(
  getService: () => Promise<Pick<GameClaimsService, "minted">>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const minted = await (await getService()).minted(context.actorUserId);
      return { ok: true, value: { minted: [...minted] } } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: listMintedMilestonesInputSchema,
    outputSchema: listMintedMilestonesResponseSchema,
    ...listMintedMilestonesRoute,
  } satisfies HttpOperation<
    ListMintedMilestonesInput,
    ListMintedMilestonesResponse
  >;
}

// The picture of one of the signed-in player's minted milestones. A claim that is not the player's is "not-found", the same answer as
// one that does not exist; a picture that cannot be shown is an answer with its reason, not an error.
export function createGetMintedPictureOperation(
  getService: () => Promise<Pick<GameClaimsService, "picture">>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const picture = await (
        await getService()
      ).picture(context.actorUserId, input.claimId);
      return {
        ok: true,
        value: picture.ok
          ? {
              contentType: picture.contentType,
              data: Buffer.from(picture.bytes).toString("base64"),
              edition: picture.edition,
              status: "ok",
            }
          : { reason: picture.code, status: "unavailable" },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: getMintedPictureInputSchema,
    outputSchema: getMintedPictureResponseSchema,
    ...getMintedPictureRoute,
  } satisfies HttpOperation<GetMintedPictureInput, GetMintedPictureResponse>;
}
