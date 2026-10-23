import { ArcadePreview } from "@repo/ui/arcade";

import type { PublicImage } from "../application/public-model.ts";

// A collection's or an item's picture, filling its frame: the image where there is one, and where the preview could not be made a
// stand-in drawn from the name that says so, so a gap is never mistaken for a broken page.
export function CollectionPicture({
  image,
  name,
}: {
  readonly image: PublicImage | null;
  readonly name: string;
}) {
  return (
    <>
      <ArcadePreview
        alt={image?.alt ?? ""}
        image={image?.src ?? null}
        name={name}
        video={null}
      />
      {image === null ? (
        <span className="gallery__note">Preview unavailable</span>
      ) : null}
    </>
  );
}
