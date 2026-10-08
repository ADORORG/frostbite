import type { ReactNode } from "react";

interface ArcadeMediaTileProps {
  readonly caption: ReactNode;
  // Shown inside the frame when there is no image, so an empty tile still says why.
  readonly placeholder: string;
  readonly image?: {
    readonly alt: string;
    readonly height: number;
    readonly src: string;
    readonly width: number;
  };
}

// A framed image with a caption area. The image keeps its intrinsic size attributes so the layout
// does not jump when it loads.
export function ArcadeMediaTile({
  caption,
  image,
  placeholder,
}: ArcadeMediaTileProps) {
  return (
    <figure className="arcade-media-tile">
      <div className="arcade-media-tile__frame">
        {image === undefined ? (
          <p className="arcade-media-tile__placeholder">{placeholder}</p>
        ) : (
          <img
            alt={image.alt}
            height={image.height}
            loading="lazy"
            src={image.src}
            width={image.width}
          />
        )}
      </div>
      <figcaption className="arcade-media-tile__caption">{caption}</figcaption>
    </figure>
  );
}
