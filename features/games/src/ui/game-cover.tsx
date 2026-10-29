import { SceneOverlay } from "@ador/scenes/react";
import { ArcadePreview } from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";

// A game's picture on a card. Its own clip comes first: a game that supplies one plays it and gets nothing laid over it. A game with a
// picture and no clip gets a scene (the one its manifest names, or one chosen from its id) laid over the picture. A game with no picture at all has the scene as its picture,
// at full strength, and never a placeholder of initials.
export function GameCover({ game }: { readonly game: PublicGame }) {
  const hasClip = game.cover?.video != null;
  const hasPicture = game.cover?.image != null;
  return (
    <>
      <ArcadePreview
        alt={game.cover?.alt ?? ""}
        image={game.cover?.image ?? null}
        name={game.title}
        standIn="plain"
        video={game.cover?.video ?? null}
      />
      {hasClip ? null : (
        <SceneOverlay
          art={!hasPicture}
          sceneId={game.scene ?? undefined}
          seed={game.id}
        />
      )}
    </>
  );
}
