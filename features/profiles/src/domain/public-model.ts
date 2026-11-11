import type { PublicGame } from "@frostbite/feature-games/catalog";
import { gameHref } from "@frostbite/shared/games";
import type { PublicProfileView } from "@frostbite/shared/profiles";

import { profileCopy } from "./copy.ts";

export interface ScoreTileModel {
  readonly achievedAt: string;
  readonly game: PublicGame;
  readonly playHref: string;
  readonly score: number;
}

export interface MintItemModel {
  readonly claimId: string;
  readonly game: PublicGame;
  readonly milestoneTitle: string;
}

export interface PublicProfileModel {
  readonly avatar: string;
  readonly bests: readonly ScoreTileModel[];
  readonly joined: string;
  readonly mints: readonly MintItemModel[];
  readonly name: string;
}

const byRecent = (left: string, right: string) =>
  new Date(right).getTime() - new Date(left).getTime();

// What the public page draws: the profile's records joined to the games the platform lists (a record of a game that is not listed is left
// out, however it got here), the newest first. The numbers stay numbers; the page formats them.
export function publicProfileModel(
  view: PublicProfileView,
  games: readonly PublicGame[],
): PublicProfileModel {
  const byId = new Map(games.map((game) => [game.id, game]));
  return {
    avatar: view.avatar,
    bests: [...view.bests]
      .sort((left, right) => byRecent(left.achievedAt, right.achievedAt))
      .flatMap((best) => {
        const game = byId.get(best.gameId);
        return game === undefined
          ? []
          : [
              {
                achievedAt: best.achievedAt,
                game,
                playHref: gameHref(game.id),
                score: best.score,
              },
            ];
      }),
    joined: profileCopy.card.joined(view.memberSince),
    mints: [...view.mints]
      .sort((left, right) => byRecent(left.mintedAt, right.mintedAt))
      .flatMap((mint) => {
        const game = byId.get(mint.gameId);
        if (game === undefined) return [];
        const milestone = game.milestones.find(
          ({ id }) => id === mint.milestoneId,
        );
        return [
          {
            claimId: mint.claimId,
            game,
            milestoneTitle: milestone?.title ?? mint.milestoneId,
          },
        ];
      }),
    name: view.name,
  };
}
