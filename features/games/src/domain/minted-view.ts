import type { MintedMilestone } from "@ador/shared/games";

import type { PublicGame } from "./catalog.ts";

// One minted milestone as the page shows it: the names the games gave, and the day, in UTC so the same reading reads the same
// everywhere. The transaction stays with the platform's records; the page is a collection to look at, not a receipt.
export interface MintedRow {
  readonly claimId: string;
  readonly gameHref: string;
  readonly gameTitle: string;
  readonly milestoneTitle: string;
  readonly mintedDay: string;
}

// While the list is being asked for, the wall holds this many empty places, so it is already the shape of a collection when the
// answer lands. It is a guess at a typical first screen, not a count of anything.
export const mintedPlaceholderCount = 3;

// "17 Oct 2026" from an ISO timestamp.
export const mintedDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

// The player's mints with each game's and milestone's name. A game or milestone the catalog no longer lists keeps its identifier as
// its name, so a mint is never hidden because a game was withdrawn.
export function mintedRows(
  minted: readonly MintedMilestone[],
  games: readonly PublicGame[],
  hrefOf: (gameId: string) => string,
): readonly MintedRow[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  return minted.map((item) => {
    const game = byId.get(item.gameId);
    return {
      claimId: item.claimId,
      gameHref: hrefOf(item.gameId),
      gameTitle: game?.title ?? item.gameId,
      milestoneTitle:
        game?.milestones.find(({ id }) => id === item.milestoneId)?.title ??
        item.milestoneId,
      mintedDay: mintedDay(item.mintedAt),
    };
  });
}
