import type { GameClaimsService } from "@frostbite/game-claims";
import type { GameSharesService } from "@frostbite/game-shares";
import type { HttpOperation } from "@frostbite/http";
import type { HttpCachePolicy } from "@frostbite/http/cache";
import { failure, unauthenticated } from "@frostbite/http/outcome";
import {
  createShareInputSchema,
  createShareResponseSchema,
  createShareRoute,
  getSharedPictureFileSchema,
  getSharedPictureInputSchema,
  getSharedPictureRoute,
  revokeShareInputSchema,
  revokeShareResponseSchema,
  revokeShareRoute,
  sharePath,
  sharedPictureContentTypes,
  type CreateShareInput,
  type CreateShareResponse,
  type GetSharedPictureFile,
  type GetSharedPictureInput,
  type RevokeShareInput,
  type RevokeShareResponse,
} from "@frostbite/shared/games";

import { pictureUnavailable } from "./minted-operation.ts";

type Service = () => Promise<GameSharesService>;

// How long a browser or the edge keeps a shared picture: the item a claim minted does not change, so an hour is a courtesy to the chain
// (each picture is a read of it), and is also how long a picture can outlive its link being ended.
export const sharedPictureCache = {
  kind: "max-age",
  seconds: 3_600,
} as const satisfies HttpCachePolicy;

// Makes a link for something the signed-in player earned. The owner is the session, never a field of the request; asking again for
// the same thing gives the same link.
export function createCreateShareOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const outcome = await (
        await getService()
      ).create(context.actorUserId, input);
      return {
        ok: true,
        value:
          outcome.kind === "shared"
            ? {
                id: outcome.share.id,
                path: sharePath(outcome.share.id),
                status: "shared",
              }
            : { reason: outcome.kind, status: "unavailable" },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: createShareInputSchema,
    outputSchema: createShareResponseSchema,
    ...createShareRoute,
  } satisfies HttpOperation<CreateShareInput, CreateShareResponse>;
}

// Ends one of the player's own links. A link that is not theirs and one that does not exist answer alike.
export function createRevokeShareOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      return {
        ok: true,
        value: {
          revoked: await (
            await getService()
          ).revoke(context.actorUserId, input.id),
        },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: revokeShareInputSchema,
    outputSchema: revokeShareResponseSchema,
    ...revokeShareRoute,
  } satisfies HttpOperation<RevokeShareInput, RevokeShareResponse>;
}

// The picture of one of the sharer's mints, for a shared page. A claim that is not the sharer's, one the link does not show, and a link
// that is ended or never was, all answer "not found": the same answer, so the address says nothing about which it was.
export function createGetSharedPictureOperation(
  getShares: Service,
  getClaims: () => Promise<Pick<GameClaimsService, "minted" | "picture">>,
) {
  return {
    access: { kind: "public" },
    applicationErrors: ["not_found"],
    cache: sharedPictureCache,
    execute: async (input) => {
      const found = await (await getShares()).find(input.id);
      const claims = await getClaims();
      const shows = (mint: { gameId: string; milestoneId: string }) =>
        found?.thing.kind === "milestones" ||
        (found?.thing.kind === "milestone" &&
          found.thing.gameId === mint.gameId &&
          found.thing.milestoneId === mint.milestoneId);
      const mint =
        found === null
          ? undefined
          : (await claims.minted(found.owner)).find(
              ({ claimId }) => claimId === input.claimId,
            );
      if (found === null || mint === undefined || !shows(mint))
        return failure("not_found", pictureUnavailable);
      const picture = await claims.picture(found.owner, input.claimId);
      return picture.ok
        ? ({
            ok: true,
            value: { bytes: picture.bytes, contentType: picture.contentType },
          } as const)
        : failure("not_found", pictureUnavailable, picture.code);
    },
    files: sharedPictureContentTypes,
    idempotency: "none",
    input: "query",
    inputSchema: getSharedPictureInputSchema,
    outputSchema: getSharedPictureFileSchema,
    ...getSharedPictureRoute,
  } satisfies HttpOperation<GetSharedPictureInput, GetSharedPictureFile>;
}
