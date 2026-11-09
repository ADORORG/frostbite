import type { GameHeat } from "@frostbite/shared/games";

import type { PublicGame } from "./catalog.ts";

// The games with the ranked ones first, in their rank, and the rest after them in the order they were given, so a platform where nothing is
// ranked yet shows the list exactly as it was. A ranking that names a game the catalog does not have is ignored.
export function hotFirst(
  games: readonly PublicGame[],
  heat: readonly GameHeat[],
): readonly PublicGame[] {
  const rankOf = new Map(heat.map(({ gameId, rank }) => [gameId, rank]));
  const ranked = games
    .filter(({ id }) => rankOf.has(id))
    .sort((a, b) => (rankOf.get(a.id) ?? 0) - (rankOf.get(b.id) ?? 0));
  return [...ranked, ...games.filter(({ id }) => !rankOf.has(id))];
}

export const heatById = (
  heat: readonly GameHeat[],
): ReadonlyMap<string, GameHeat> =>
  new Map(heat.map((entry) => [entry.gameId, entry]));
