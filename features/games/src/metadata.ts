import {
  clipDescription,
  privatePage,
  type PageMetadata,
} from "@frostbite/plugin-kit/page-metadata";
import {
  gameHref,
  gamesPath,
  shareImagePath,
  type GameManifest,
} from "@frostbite/shared/games";
import type { SharedThing } from "@frostbite/game-shares";

import type { GameCatalog, PublicGame } from "./domain/catalog.ts";
import { shareCopy } from "./domain/share-copy.ts";
import { sharedView } from "./domain/shared-view.ts";

// Where a game's share picture is served (see `apps/web/src/app/share/games`). The address is the game's own identifier, which
// is a validated slug, so it needs no escaping.
export const gameShareImagePath = (id: string): `/${string}` =>
  `${gamesPath}/${id}/share-image`;

export const gamesIndexMetadata: PageMetadata = {
  description:
    "Browser games to play right now. Earn milestones as you play and collect them.",
  kind: "shared",
  title: "Games",
};

// A game's own title and summary, and a picture made from its cover. An identifier that is not a registered game says nothing.
export function gameMetadata(
  catalog: GameCatalog,
  slug: string | undefined,
): PageMetadata {
  const game: PublicGame | null = catalog.find(slug);
  if (game === null) return privatePage;
  return {
    description: clipDescription(game.summary),
    image: {
      alt: game.cover?.alt ?? `${game.title}, a game in the arcade`,
      path: gameShareImagePath(game.id),
    },
    kind: "shared",
    title: game.title,
  };
}

// The games page and each registered game's page; nothing when no game is registered.
export function gameSitemapPaths(
  catalog: GameCatalog,
): readonly `/${string}`[] {
  const games = catalog.list();
  return games.length === 0
    ? []
    : [gamesPath, ...games.map(({ id }) => gameHref(id) as `/${string}`)];
}

// A shared link says what it shows and carries a picture made for it. A link that is ended, never was, or shows a game or milestone that
// is no longer listed says nothing, so a preview cannot outlive the thing it showed.
export function sharedMetadata(
  id: string,
  thing: SharedThing | null,
  games: readonly GameManifest[],
): PageMetadata {
  const view = thing === null ? null : sharedView(thing, games);
  if (view === null) return privatePage;
  return {
    description: clipDescription(
      view.verification === null
        ? view.subtitle
        : `${view.subtitle} ${shareCopy.verification[view.verification]}.`,
    ),
    image: { alt: view.title, path: shareImagePath(id) },
    kind: "shared",
    title: view.title,
  };
}
