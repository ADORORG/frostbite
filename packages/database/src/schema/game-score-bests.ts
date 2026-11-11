import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// A player's best verified score in a game, for each period a board is kept for: `all` (one period, starting 1970-01-01), each `month` and each
// `week` (starting Monday), in UTC. The rows are kept by a trigger on `game_runs` (see the migration that made them): a run that settles as
// verified with a score offers it to its three periods, and a period keeps the higher one, the earlier run winning a tie. So a board is a read
// of one index however many runs there are, and a past period stays as it ended (its winners are just rows). A player's rows go with the
// account. Only the platform's own replay can put a row here: `game_runs.score` is checked to belong to a verified run.
export const gameScoreBests = platformSchema.table(
  "game_score_bests",
  {
    gameId: text("game_id").notNull(),
    windowKind: text("window_kind").notNull(),
    windowStart: date("window_start", { mode: "string" }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    score: bigint("score", { mode: "number" }).notNull(),
    achievedAt: timestamp("achieved_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.gameId,
        table.windowKind,
        table.windowStart,
        table.userId,
      ],
    }),
    // A board: the best scores of a game in a period, highest first, the earlier reaching it first.
    index("game_score_bests_board_idx").on(
      table.gameId,
      table.windowKind,
      table.windowStart,
      table.score.desc(),
      table.achievedAt.asc(),
    ),
    check(
      "game_score_bests_kind_known",
      sql`${table.windowKind} in ('all', 'month', 'week')`,
    ),
    check("game_score_bests_not_negative", sql`${table.score} >= 0`),
  ],
);
