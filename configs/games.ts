import { defineGames } from "@ador/shared/games";

import { frostbite } from "./games/frostbite.ts";

// The games the platform lists: one line per game. A game is added here and nowhere else; the catalog and the
// detail pages read this list.
export const games = defineGames([frostbite]);
