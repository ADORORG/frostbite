import { pickRendition } from "@frostbite/feature-uploads/presentation";
import type { LibraryAsset } from "@frostbite/shared/uploads";

// The small picture a card can show for a collection's cover.
export interface CoverPicture {
  readonly height: number;
  readonly src: string;
  readonly width: number;
}

// The thumbnail of each processed image, by image id. An image that is not processed, or whose picture
// could not be signed, has no entry, so a card falls back to its monogram instead of a broken image.
export function coverPictures(
  assets: readonly LibraryAsset[],
): ReadonlyMap<string, CoverPicture> {
  const pictures = new Map<string, CoverPicture>();
  for (const asset of assets) {
    if (asset.processingState !== "processed") continue;
    const thumbnail = pickRendition(asset.derivatives, "thumbnail");
    if (thumbnail !== undefined)
      pictures.set(asset.id, {
        height: thumbnail.heightPixels,
        src: thumbnail.url,
        width: thumbnail.widthPixels,
      });
  }
  return pictures;
}
