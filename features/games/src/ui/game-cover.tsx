import { SceneOverlay } from "@ador/scenes/react";
import { ArcadePreview } from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";

// A game's picture on a card. Its own clip comes first: a game that supplies one plays it and gets nothing laid over it. Without one, a
// scene chosen from the game's id plays over the picture, the same scene every time, so every game on a list is alive.
export function GameCover({ game }: { readonly game: PublicGame }) {
  return (
    <>
      <ArcadePreview
        alt={game.cover?.alt ?? ""}
        image={game.cover?.image ?? null}
        name={game.title}
        video={game.cover?.video ?? null}
      />
      {game.cover?.video == null ? <SceneOverlay seed={game.id} /> : null}
    </>
  );
}
