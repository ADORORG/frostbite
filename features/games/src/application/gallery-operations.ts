import type { GameClaimsService, PublicMints } from "@frostbite/game-claims";
import type { HttpOperation } from "@frostbite/http";
import type { HttpCachePolicy } from "@frostbite/http/cache";
import { failure } from "@frostbite/http/outcome";
import {
  decodeGalleryCursor,
  encodeGalleryCursor,
  galleryPageSize,
  galleryPictureContentTypes,
  getGalleryPictureFileSchema,
  getGalleryPictureInputSchema,
  getGalleryPictureRoute,
  listGalleryMintsInputSchema,
  listGalleryMintsResponseSchema,
  listGalleryMintsRoute,
  type GetGalleryPictureFile,
  type GetGalleryPictureInput,
  type ListGalleryMintsInput,
  type ListGalleryMintsResponse,
} from "@frostbite/shared/games";
import { shortenMiddle } from "@repo/ui/shorten-middle";

import { pictureUnavailable } from "./minted-operation.ts";

type Gallery = () => Promise<PublicMints>;

// How long a browser or the edge keeps a page of the gallery: a mint that has just completed may take a minute to show, and a list that
// is read by anyone should not be read from the database by everyone.
export const galleryCache = {
  kind: "max-age",
  seconds: 60,
} as const satisfies HttpCachePolicy;
// A picture belongs to a completed claim and does not change, so it is kept as a shared one is.
export const galleryPictureCache = {
  kind: "max-age",
  seconds: 3_600,
} as const satisfies HttpCachePolicy;

// A game's mints, public. A game the platform does not list, and a cursor that is not one, are "not found" and a bad request. The first page
// also carries how many players minted each milestone.
export function createListGalleryMintsOperation(
  getGallery: Gallery,
  listed: ReadonlySet<string>,
) {
  return {
    access: { kind: "public" },
    applicationErrors: ["not_found"],
    cache: galleryCache,
    execute: async (input) => {
      if (!listed.has(input.gameId))
        return failure("not_found", "No such game.");
      const after =
        input.cursor === undefined
          ? undefined
          : (decodeGalleryCursor(input.cursor) ?? undefined);
      const gallery = await getGallery();
      const [page, counts] = await Promise.all([
        gallery.page(input.gameId, galleryPageSize, after),
        input.cursor === undefined
          ? gallery.counts(input.gameId)
          : Promise.resolve(null),
      ]);
      return {
        ok: true,
        value: {
          counts:
            counts === null
              ? null
              : [...counts].map(([milestoneId, count]) => ({
                  count,
                  milestoneId,
                })),
          mints: page.mints.map((mint) => ({
            claimId: mint.claimId,
            milestoneId: mint.milestoneId,
            mintedAt: mint.mintedAt.toISOString(),
            transactionId: mint.transactionId,
            verification: mint.verification,
            wallet: shortenMiddle(mint.wallet),
          })),
          next: page.next === null ? null : encodeGalleryCursor(page.next),
        },
      } as const;
    },
    idempotency: "none",
    input: "query",
    inputSchema: listGalleryMintsInputSchema,
    outputSchema: listGalleryMintsResponseSchema,
    ...listGalleryMintsRoute,
  } satisfies HttpOperation<ListGalleryMintsInput, ListGalleryMintsResponse>;
}

// The picture of a completed claim of a listed game, for the gallery: asked for by the claim, read as the player it belongs to, never
// for a claim that is not complete.
export function createGetGalleryPictureOperation(
  getGallery: Gallery,
  getClaims: () => Promise<Pick<GameClaimsService, "picture">>,
  listed: ReadonlySet<string>,
) {
  return {
    access: { kind: "public" },
    applicationErrors: ["not_found"],
    cache: galleryPictureCache,
    execute: async (input) => {
      const owner = await (await getGallery()).owner(input.claimId);
      if (owner === null || !listed.has(owner.gameId))
        return failure("not_found", pictureUnavailable);
      const picture = await (
        await getClaims()
      ).picture(owner.userId, input.claimId);
      return picture.ok
        ? ({
            ok: true,
            value: { bytes: picture.bytes, contentType: picture.contentType },
          } as const)
        : failure("not_found", pictureUnavailable, picture.code);
    },
    files: galleryPictureContentTypes,
    idempotency: "none",
    input: "query",
    inputSchema: getGalleryPictureInputSchema,
    outputSchema: getGalleryPictureFileSchema,
    ...getGalleryPictureRoute,
  } satisfies HttpOperation<GetGalleryPictureInput, GetGalleryPictureFile>;
}
