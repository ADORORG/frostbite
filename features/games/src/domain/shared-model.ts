import type { MintedClaim } from "@frostbite/game-claims";
import type { SharedThing } from "@frostbite/game-shares";
import {
  gameHref,
  gamesPath,
  sharedPictureHref,
} from "@frostbite/shared/games";
import type { ShareVerification } from "@frostbite/shared/games";

import type { PublicGame } from "./catalog.ts";
import { mintedDay } from "./minted-view.ts";

// What a shared page shows, made from the sharer's own records and the games' manifests: enough to make a visitor want to be there. Nothing in it
// names the sharer; a picture is an address the page asks for, never the sharer's account.
export interface SharedGameInfo {
  readonly cover: { readonly alt: string; readonly image: string } | null;
  readonly id: string;
  readonly playHref: string;
  readonly title: string;
}

export interface SharedPiece {
  readonly claimId: string;
  readonly day: string;
  readonly game: string;
  readonly picture: string;
  readonly title: string;
}

export type SharedModel =
  | {
      readonly kind: "milestone";
      readonly criteria: string;
      readonly description: string;
      readonly game: SharedGameInfo;
      // The sharer's own mint of it, when the network shows one: the day, and where its picture is.
      readonly mint: { readonly day: string; readonly picture: string } | null;
      // How many players have minted it, when that is known; never guessed.
      readonly mintCount: number | null;
      readonly title: string;
      readonly verification: ShareVerification;
    }
  | {
      readonly kind: "score";
      readonly game: SharedGameInfo;
      readonly score: string;
      readonly verification: ShareVerification;
    }
  | {
      readonly kind: "milestones";
      readonly browseHref: string;
      // How many games the pieces come from, and how many pieces there are beyond those shown.
      readonly games: number;
      readonly more: number;
      readonly pieces: readonly SharedPiece[];
    };

// The most pieces a shelf's page lays out; the rest are counted.
export const sharedShelfLimit = 24;

const gameInfo = (game: PublicGame): SharedGameInfo => ({
  cover:
    game.cover === null
      ? null
      : { alt: game.cover.alt, image: game.cover.image },
  id: game.id,
  playHref: gameHref(game.id),
  title: game.title,
});

// Whole numbers are written the same everywhere, whatever the reader's locale, so a page and a card agree.
export const groupedNumber = (value: number) => value.toLocaleString("en-US");

// The model of a share, or null when what it shows is gone (a game no longer listed, a milestone no longer declared), so the page then says
// the link is not shared any more.
export function sharedModel(input: {
  readonly counts: ReadonlyMap<string, number> | null;
  readonly games: readonly PublicGame[];
  readonly id: string;
  // The sharer's minted milestones, newest first.
  readonly mints: readonly MintedClaim[];
  readonly thing: SharedThing;
}): SharedModel | null {
  const { games, id, mints, thing } = input;
  if (thing.kind === "milestones") {
    const pieces = mints.flatMap((mint) => {
      const game = games.find((candidate) => candidate.id === mint.gameId);
      const milestone = game?.milestones.find(
        ({ id: own }) => own === mint.milestoneId,
      );
      return game === undefined || milestone === undefined
        ? []
        : [
            {
              claimId: mint.claimId,
              day: mintedDay(mint.mintedAt),
              game: game.title,
              picture: sharedPictureHref(id, mint.claimId),
              title: milestone.title,
            },
          ];
    });
    return {
      browseHref: gamesPath,
      games: new Set(pieces.map(({ game }) => game)).size,
      kind: "milestones",
      more: Math.max(0, pieces.length - sharedShelfLimit),
      pieces: pieces.slice(0, sharedShelfLimit),
    };
  }
  const game = games.find(({ id: own }) => own === thing.gameId);
  if (game === undefined) return null;
  if (thing.kind === "score")
    return {
      game: gameInfo(game),
      kind: "score",
      score: groupedNumber(thing.score),
      verification: thing.verification,
    };
  const milestone = game.milestones.find(
    ({ id: own }) => own === thing.milestoneId,
  );
  if (milestone === undefined) return null;
  const mint = mints.find(
    ({ gameId, milestoneId }) =>
      gameId === game.id && milestoneId === milestone.id,
  );
  return {
    criteria: milestone.criteria,
    description: milestone.description,
    game: gameInfo(game),
    kind: "milestone",
    mint:
      mint === undefined
        ? null
        : {
            day: mintedDay(mint.mintedAt),
            picture: sharedPictureHref(id, mint.claimId),
          },
    mintCount: input.counts?.get(milestone.id) ?? null,
    title: milestone.title,
    verification: thing.verification,
  };
}
