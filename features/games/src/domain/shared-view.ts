import {
  gameHref,
  gamesPath,
  type GameManifest,
} from "@frostbite/shared/games";
import type { ShareVerification } from "@frostbite/shared/games";
import type { SharedThing } from "@frostbite/game-shares";

import { shareCopy } from "./share-copy.ts";

// What a shared page and its preview picture show for a share: the words, how it is known, and where to go and play. Built from the
// listed games, so a share of a game that is no longer listed (or a milestone it no longer declares) has no view and shows nothing.
export interface SharedView {
  readonly cover: { readonly alt: string; readonly image: string } | null;
  readonly gameId: string | null;
  readonly kicker: string;
  readonly playHref: string;
  readonly playLabel: string;
  readonly subtitle: string;
  readonly title: string;
  readonly verification: ShareVerification | null;
}

// Whole numbers are written the same everywhere, whatever the reader's locale, so a card and a page agree.
const groupedScore = (score: number) => score.toLocaleString("en-US");

export function sharedView(
  thing: SharedThing,
  games: readonly GameManifest[],
): SharedView | null {
  if (thing.kind === "milestones")
    return {
      cover: null,
      gameId: null,
      kicker: shareCopy.collectionKicker,
      playHref: gamesPath,
      playLabel: shareCopy.browse,
      subtitle: shareCopy.collectionSubtitle,
      title: shareCopy.collectionTitle,
      verification: null,
    };
  const game = games.find(({ id }) => id === thing.gameId);
  if (game === undefined) return null;
  const common = {
    cover:
      game.cover === undefined
        ? null
        : { alt: game.cover.alt, image: game.cover.image },
    gameId: game.id,
    playHref: gameHref(game.id),
    playLabel: shareCopy.play(game.title),
    verification: thing.verification,
  };
  if (thing.kind === "score")
    return {
      ...common,
      kicker: shareCopy.scoreKicker,
      subtitle: shareCopy.scoreSubtitle,
      title: shareCopy.scoreTitle(groupedScore(thing.score), game.title),
    };
  const milestone = game.milestones.find(({ id }) => id === thing.milestoneId);
  if (milestone === undefined) return null;
  return {
    ...common,
    kicker: shareCopy.milestoneKicker,
    subtitle: shareCopy.milestoneSubtitle(game.title),
    title: milestone.title,
  };
}

// The line above a preview picture's title: what it is and, when the platform has a level for it, how it is known, so a card never
// reads as proof of more than it is.
export const cardKicker = (view: SharedView) =>
  view.verification === null
    ? view.kicker
    : `${view.kicker} · ${shareCopy.verification[view.verification]}`;
