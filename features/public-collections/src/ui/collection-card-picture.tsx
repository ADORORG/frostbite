import { SceneOverlay } from "@ador/scenes/react";
import { ArcadePreview } from "@repo/ui/arcade";

import type { PublicCard } from "../application/public-model.ts";

// A collection's picture on a card. Its own picture is shown as it is, with nothing laid over a creator's art. A collection with no picture
// has a scene as its picture, at full strength, and never a placeholder of initials or a note about a missing preview.
export function CollectionCardPicture({ card }: { readonly card: PublicCard }) {
  return (
    <>
      <ArcadePreview
        alt={card.cover?.alt ?? ""}
        image={card.cover?.src ?? null}
        name={card.name}
        standIn="plain"
        video={null}
      />
      {card.cover === null ? <SceneOverlay art seed={card.id} /> : null}
    </>
  );
}
