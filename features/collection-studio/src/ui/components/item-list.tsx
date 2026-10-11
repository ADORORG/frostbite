import { pickRendition } from "@ador/feature-uploads/presentation";
import type { CollectionDetail } from "@ador/shared/collections";
import {
  ArcadeActionButton,
  ArcadeBadge,
  ArcadeMediaTile,
} from "@repo/ui/arcade";
import { useState } from "react";

type Item = CollectionDetail["items"][number];

// The draft's items in order, each with its image. Removing asks for a second click, because it
// cannot be undone (the image stays in the library; the item's text does not).
export function ItemList({
  busy,
  items,
  onEdit,
  onRemove,
  previews,
}: {
  readonly busy: boolean;
  readonly items: readonly Item[];
  readonly onEdit: (item: Item) => void;
  readonly onRemove: (item: Item) => void;
  readonly previews: CollectionDetail["previews"];
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (items.length === 0) return <p>No items yet. Add the first one below.</p>;
  return (
    <ol aria-label="Items in this collection" className="arcade-grid">
      {items.map((item) => {
        const preview = previews.find(({ id }) => id === item.imageAssetId);
        const thumbnail =
          preview === undefined
            ? undefined
            : pickRendition(preview.derivatives, "thumbnail");
        return (
          <li key={item.id}>
            <ArcadeMediaTile
              caption={
                <>
                  <strong>{`${item.position}. ${item.name}`}</strong>
                  <ArcadeBadge tone="cyan">
                    {item.attributes.length === 1
                      ? "1 trait"
                      : `${item.attributes.length} traits`}
                  </ArcadeBadge>
                  <span className="arcade-actions">
                    <ArcadeActionButton
                      disabled={busy}
                      onClick={() => onEdit(item)}
                      tone="yellow"
                    >
                      {`Edit ${item.name}`}
                    </ArcadeActionButton>
                    {confirming === item.id ? (
                      <>
                        <ArcadeActionButton
                          disabled={busy}
                          onClick={() => {
                            setConfirming(null);
                            onRemove(item);
                          }}
                          tone="red"
                        >
                          {`Confirm removing ${item.name}`}
                        </ArcadeActionButton>
                        <ArcadeActionButton
                          onClick={() => setConfirming(null)}
                          tone="pink"
                        >
                          Keep it
                        </ArcadeActionButton>
                      </>
                    ) : (
                      <ArcadeActionButton
                        disabled={busy}
                        onClick={() => setConfirming(item.id)}
                        tone="red"
                      >
                        {`Remove ${item.name}`}
                      </ArcadeActionButton>
                    )}
                  </span>
                </>
              }
              image={
                thumbnail === undefined
                  ? undefined
                  : {
                      alt: `Image for ${item.name}`,
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
    </ol>
  );
}
