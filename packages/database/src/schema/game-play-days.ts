import { sql } from "drizzle-orm";
import { check, date, integer, primaryKey, text } from "drizzle-orm/pg-core";

import { platformSchema } from "./platform.ts";

// How many runs of a game were started on each day (UTC), by anyone, signed in or not. It is what "hot" is ranked from: the days in the
// last week added up. A row is a count and nothing more, so it names no one and cannot be traced to a player. A count is soft by design:
// a start is counted by the page that frames the game (a game cannot count itself), once a visitor's allowance for the minute is not used up.
export const gamePlayDays = platformSchema.table(
  "game_play_days",
  {
    gameId: text("game_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    plays: integer("plays").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.day] }),
    check("game_play_days_plays_positive", sql`${table.plays} > 0`),
  ],
);
