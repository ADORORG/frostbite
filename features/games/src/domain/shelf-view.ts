import type { MintedMilestone } from "@ador/shared/games";

import type { PublicCover, PublicGame } from "./catalog.ts";
import { mintedDay } from "./minted-view.ts";

// One minted milestone as a piece on a shelf. The transaction is here, for the detail view that links to it; the shelf itself is a
// collection to look at, not a receipt.
export interface ShelfPiece {
  readonly claimId: string;
  readonly description: string;
  readonly mintedAt: string;
  readonly mintedDay: string;
  readonly milestoneId: string;
  // "first" is the game's earliest mint; "latest" the newest of all (it wins, once there is more than one mint to tell apart).
  readonly ribbon: "first" | "latest" | null;
  readonly title: string;
  readonly transactionId: string;
}

// A milestone of the game the player has not minted yet.
export interface ShelfMissing {
  readonly milestoneId: string;
  readonly title: string;
}

export interface Shelf {
  readonly cover: PublicCover | null;
  // How many of the game's milestones have been minted at least once, out of how many it has.
  readonly earned: number;
  readonly gameHref: string;
  readonly gameId: string;
  readonly gameTitle: string;
  // What is still to earn, in the game's order.
  readonly missing: readonly ShelfMissing[];
  // The pieces on display, in the game's order of milestones (a repeatable one shows each of its mints).
  readonly pieces: readonly ShelfPiece[];
  readonly total: number;
}

export interface ShelfStats {
  readonly firstDay: string | null;
  readonly games: number;
  readonly latest: { readonly day: string; readonly title: string } | null;
  readonly pieces: number;
}

const byNewest = (a: MintedMilestone, b: MintedMilestone) =>
  b.mintedAt.localeCompare(a.mintedAt) || a.claimId.localeCompare(b.claimId);

// The player's shelves: a shelf for every game that can mint milestones, and one for any game they hold a mint of (a withdrawn game
// keeps its identifier as a name, so a mint is never hidden). Games with mints come first, newest mint first; the rest follow in the
// catalog's order. A repeatable milestone shows each of its mints; one never minted is listed as still to earn.
export function shelves(
  minted: readonly MintedMilestone[],
  games: readonly PublicGame[],
  hrefOf: (gameId: string) => string,
): readonly Shelf[] {
  const newest = [...minted].sort(byNewest);
  const latestClaim = newest.length > 1 ? newest[0]?.claimId : undefined;
  const catalog = new Map(games.map((game) => [game.id, game]));
  const order = [
    ...new Set([
      ...newest.map(({ gameId }) => gameId),
      ...games.filter(({ claimable }) => claimable).map(({ id }) => id),
    ]),
  ];
  return order.map((gameId) => {
    const game = catalog.get(gameId);
    const mine = newest.filter((item) => item.gameId === gameId);
    const firstClaim = mine.at(-1)?.claimId;
    const known = game?.milestones ?? [];
    const titles = new Map(known.map(({ id, title }) => [id, title]));
    const descriptions = new Map(
      known.map(({ description, id }) => [id, description]),
    );
    const ids = [
      ...new Set([
        ...known.map(({ id }) => id),
        ...mine.map((m) => m.milestoneId),
      ]),
    ];
    const pieces = ids.flatMap((milestoneId): readonly ShelfPiece[] =>
      mine
        .filter((item) => item.milestoneId === milestoneId)
        .map((item) => ({
          claimId: item.claimId,
          description: descriptions.get(milestoneId) ?? "",
          milestoneId,
          mintedAt: item.mintedAt,
          mintedDay: mintedDay(item.mintedAt),
          ribbon:
            item.claimId === latestClaim
              ? "latest"
              : item.claimId === firstClaim
                ? "first"
                : null,
          title: titles.get(milestoneId) ?? milestoneId,
          transactionId: item.transactionId,
        })),
    );
    const mintedIds = new Set(mine.map(({ milestoneId }) => milestoneId));
    const missing = ids
      .filter((milestoneId) => !mintedIds.has(milestoneId))
      .map((milestoneId) => ({
        milestoneId,
        title: titles.get(milestoneId) ?? milestoneId,
      }));
    return {
      cover: game?.cover ?? null,
      earned: mintedIds.size,
      gameHref: hrefOf(gameId),
      gameId,
      gameTitle: game?.title ?? gameId,
      missing,
      pieces,
      total: ids.length,
    };
  });
}

// What the header says of the player's collection as a whole. Titles fall back to identifiers like the shelves do.
export function shelfStats(
  minted: readonly MintedMilestone[],
  games: readonly PublicGame[],
): ShelfStats {
  const newest = [...minted].sort(byNewest);
  const last = newest[0];
  const first = newest.at(-1);
  const title = (item: MintedMilestone) =>
    games
      .find(({ id }) => id === item.gameId)
      ?.milestones.find(({ id }) => id === item.milestoneId)?.title ??
    item.milestoneId;
  return {
    firstDay: first === undefined ? null : mintedDay(first.mintedAt),
    games: new Set(minted.map(({ gameId }) => gameId)).size,
    latest:
      last === undefined
        ? null
        : { day: mintedDay(last.mintedAt), title: title(last) },
    pieces: minted.length,
  };
}
