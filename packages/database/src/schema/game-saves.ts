import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// A signed-in player's latest save for one game. `progress_saved_at` is the time the player's device gave
// the save (bounded to the server's clock), the value the merge rule compares; the row exists as soon as the
// player first syncs the game, with no save yet, so a sync can lock it. The size is stored so a limit can be
// checked without reading the document. `player_id` is what the game is told the player is: random, made with the
// row, and kept as long as the row, so it identifies the player to this game alone and cannot be worked out
// from the account or from another game's id.
export const gameSaves = platformSchema.table(
  "game_saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    playerId: uuid("player_id").notNull().defaultRandom(),
    progress: jsonb("progress"),
    progressBytes: integer("progress_bytes").notNull().default(0),
    progressSavedAt: timestamp("progress_saved_at", {
      mode: "date",
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameId] }),
    unique("game_saves_player_id_key").on(table.playerId),
    check(
      "game_saves_progress_coherent",
      sql`(${table.progress} is null) = (${table.progressSavedAt} is null)`,
    ),
    check(
      "game_saves_bytes_bounded",
      sql`${table.progressBytes} between 0 and 1048576`,
    ),
  ],
);

// A milestone a player earned, once per player, game and milestone. Only self-reported milestones exist
// (the column says so, and a stronger level is a migration), so nothing here can be mistaken for proof.
export const gameMilestoneUnlocks = platformSchema.table(
  "game_milestone_unlocks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    milestoneId: text("milestone_id").notNull(),
    unlockedAt: timestamp("unlocked_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    verification: text("verification").notNull().default("self-reported"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameId, table.milestoneId] }),
    check(
      "game_milestone_verification_known",
      sql`${table.verification} in ('self-reported')`,
    ),
  ],
);
