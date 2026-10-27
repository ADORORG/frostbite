import type { GameClaimsService } from "@ador/game-claims";
import type { HttpOperation } from "@ador/http";
import type { HttpCachePolicy } from "@ador/http/cache";
import { failure, unauthenticated } from "@ador/http/outcome";
import {
  getMintedPictureInputSchema,
  getMintedPictureFileSchema,
  mintedPictureContentTypes,
  getMintedPictureRoute,
  listMintedMilestonesInputSchema,
  listMintedMilestonesResponseSchema,
  listMintedMilestonesRoute,
  type GetMintedPictureInput,
  type GetMintedPictureFile,
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
    cache: { kind: "revalidate" },
    input: "query",
    inputSchema: listMintedMilestonesInputSchema,
    outputSchema: listMintedMilestonesResponseSchema,
    ...listMintedMilestonesRoute,
  } satisfies HttpOperation<
    ListMintedMilestonesInput,
    ListMintedMilestonesResponse
  >;
}

// How long a browser keeps a minted picture. The item a claim minted does not change, so a day is a courtesy to the chain (each
// picture is a read of it), not a freshness promise; a picture that was not there is never kept (an error is never cached).
export const mintedPictureCache = {
  kind: "max-age",
  seconds: 86_400,
} as const satisfies HttpCachePolicy;

// The picture of one of the signed-in player's minted milestones, as a file. A claim that is not the player's is "not-found", the
// same answer as one that does not exist; a picture that cannot be shown is a not-found with its reason.
export function createGetMintedPictureOperation(
  getService: () => Promise<Pick<GameClaimsService, "picture">>,
) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["not_found", "unauthorized"],
    cache: mintedPictureCache,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const picture = await (
        await getService()
      ).picture(context.actorUserId, input.claimId);
      return picture.ok
        ? ({
            ok: true,
            value: { bytes: picture.bytes, contentType: picture.contentType },
          } as const)
        : failure("not_found", "The picture is not available.", picture.code);
    },
    files: mintedPictureContentTypes,
    idempotency: "none",
    input: "query",
    inputSchema: getMintedPictureInputSchema,
    outputSchema: getMintedPictureFileSchema,
    ...getMintedPictureRoute,
  } satisfies HttpOperation<GetMintedPictureInput, GetMintedPictureFile>;
}
