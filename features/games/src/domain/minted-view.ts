import type { MintedMilestone } from "@ador/shared/games";

import type { PublicGame } from "./catalog.ts";

// One minted milestone as the page lists it: the names the games gave, and when, in UTC so the same reading reads the same everywhere.
export interface MintedRow {
  readonly claimId: string;
  readonly gameHref: string;
  readonly gameTitle: string;
  readonly milestoneTitle: string;
  readonly mintedOn: string;
  readonly transactionId: string;
}

// "2026-10-17 12:00 UTC" from an ISO timestamp.
export const mintedOn = (iso: string) =>
  `${iso.slice(0, 16).replace("T", " ")} UTC`;

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
      mintedOn: mintedOn(item.mintedAt),
      transactionId: item.transactionId,
    };
  });
}
