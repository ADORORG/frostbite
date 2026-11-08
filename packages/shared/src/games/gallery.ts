import { z } from "zod";

import { gameIdSchema } from "./manifest.ts";
import { shareVerifications } from "./shares.ts";

// The public gallery of a game's mints: every milestone the network's records show minted, newest first, a page at a time, with how many
// players minted each milestone. Anyone may read it; it names no player, only the wallet a mint went to, in short form, and says how the
// platform knew each milestone was earned so the page never reads as proof of more than it is.
export const galleryPageSize = 24;

export const publicMintSchema = z
  .object({
    claimId: z.uuid(),
    milestoneId: gameIdSchema,
    mintedAt: z.iso.datetime({ offset: true }),
    transactionId: z.string().min(1).max(128),
    verification: z.enum(shareVerifications),
    // Shortened by the server, so the whole address never leaves it.
    wallet: z.string().min(1).max(32),
  })
  .strict();
export type PublicMintView = z.infer<typeof publicMintSchema>;

// Where the next page starts: the time of the last mint shown and its identifier, in the order the list is kept.
const cursorShape =
  /^(?<at>\d{4}-\d{2}-\d{2}T[\d:.]+Z)_(?<claim>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/u;
export const galleryCursorSchema = z.string().max(80).regex(cursorShape);
export const encodeGalleryCursor = (cursor: {
  readonly claimId: string;
  readonly completedAt: Date;
}) => `${cursor.completedAt.toISOString()}_${cursor.claimId}`;
export function decodeGalleryCursor(
  text: string,
): { readonly claimId: string; readonly completedAt: Date } | null {
  const found = cursorShape.exec(text)?.groups;
  if (found?.at === undefined || found.claim === undefined) return null;
  const completedAt = new Date(found.at);
  return Number.isNaN(completedAt.getTime())
    ? null
    : { claimId: found.claim, completedAt };
}

export const listGalleryMintsInputSchema = z
  .object({ cursor: galleryCursorSchema.optional(), gameId: gameIdSchema })
  .strict();
export const listGalleryMintsResponseSchema = z
  .object({
    // How many players minted each milestone; asked for with the first page only, so paging on does not count again.
    counts: z
      .array(
        z.object({ count: z.int().min(1), milestoneId: gameIdSchema }).strict(),
      )
      .max(500)
      .nullable(),
    mints: z.array(publicMintSchema).max(galleryPageSize),
    next: galleryCursorSchema.nullable(),
  })
  .strict();
export type ListGalleryMintsInput = z.infer<typeof listGalleryMintsInputSchema>;
export type ListGalleryMintsResponse = z.infer<
  typeof listGalleryMintsResponseSchema
>;
export const listGalleryMintsRoute = {
  method: "GET",
  operationId: "listGalleryMints",
  path: "/api/v1/games/gallery",
} as const;

export const galleryPictureContentTypes = ["image/svg+xml"] as const;
export const getGalleryPictureInputSchema = z
  .object({ claimId: z.uuid() })
  .strict();
export const getGalleryPictureFileSchema = z
  .object({
    bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
    contentType: z.enum(galleryPictureContentTypes),
  })
  .strict();
export type GetGalleryPictureInput = z.infer<
  typeof getGalleryPictureInputSchema
>;
export type GetGalleryPictureFile = z.infer<typeof getGalleryPictureFileSchema>;
export const getGalleryPictureRoute = {
  method: "GET",
  operationId: "getGalleryPicture",
  path: "/api/v1/games/gallery/picture",
} as const;
export const galleryPictureHref = (claimId: string) =>
  `${getGalleryPictureRoute.path}?${new URLSearchParams({ claimId }).toString()}`;
