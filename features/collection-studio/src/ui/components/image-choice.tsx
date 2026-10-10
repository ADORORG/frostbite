import { pickRendition } from "@ador/feature-uploads/presentation";
import type { LibraryAsset, UploadPurpose } from "@ador/shared/uploads";
import { ArcadeButton, ArcadeMediaTile } from "@repo/ui/arcade";
import { useId } from "react";

// The creator's own processed images made for one purpose, offered as a radio group. Only a processed
// image can be chosen (the server refuses anything else), and an empty library says how to fill it.
export function ImageChoice({
  allowNone,
  assets,
  disabled,
  legend,
  onChange,
  purpose,
  selectedId,
  uploadHref,
}: {
  readonly allowNone: boolean;
  readonly assets: readonly LibraryAsset[];
  readonly disabled: boolean;
  readonly legend: string;
  readonly onChange: (assetId: string | null) => void;
  readonly purpose: UploadPurpose;
  readonly selectedId: string | null;
  readonly uploadHref: string;
}) {
  const group = useId();
  const choices = assets.filter(
    (asset) =>
      asset.purpose === purpose && asset.processingState === "processed",
  );
  // A chosen image that is no longer in the list (not loaded yet, or removed) is still shown as chosen.
  const orphan =
    selectedId !== null && !choices.some(({ id }) => id === selectedId);
  return (
    <fieldset className="arcade-choice">
      <legend>{legend}</legend>
      {choices.length === 0 ? (
        <p>
          You have no ready images for this yet.{" "}
          <ArcadeButton href={uploadHref} tone="yellow">
            Upload images
          </ArcadeButton>
        </p>
      ) : null}
      {allowNone ? (
        <label>
          <input
            checked={selectedId === null}
            disabled={disabled}
            name={group}
            onChange={() => onChange(null)}
            type="radio"
          />
          None
        </label>
      ) : null}
      {orphan ? (
        <p>An image you chose earlier is not in the list above.</p>
      ) : null}
      <ul className="arcade-grid">
        {choices.map((asset) => {
          const thumbnail = pickRendition(asset.derivatives, "thumbnail");
          return (
            <li key={asset.id}>
              <ArcadeMediaTile
                caption={
                  <label>
                    <input
                      checked={selectedId === asset.id}
                      disabled={disabled}
                      name={group}
                      onChange={() => onChange(asset.id)}
                      type="radio"
                    />
                    Choose this image
                  </label>
                }
                image={
                  thumbnail === undefined
                    ? undefined
                    : {
                        alt: `Image uploaded ${asset.createdAt.slice(0, 10)}`,
                        height: thumbnail.heightPixels,
                        src: thumbnail.url,
                        width: thumbnail.widthPixels,
                      }
                }
                placeholder="Preview unavailable"
              />
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
