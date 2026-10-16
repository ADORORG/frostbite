import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";
import {
  settledStatesSql,
  trackedTransactionChecks,
  trackedTransactionColumns,
} from "./tracked-transaction.ts";

// A player's claim of a milestone from a game's rewards contract, as the platform tracks it: who, which game and milestone,
// the transaction built for it (what the wallet was shown and signed), and where it is in the chain's lifecycle. At most one
// claim per player, game and milestone is in progress at a time, which is what makes asking again return the same claim.
// `expected_claims` is the count the chain's indexed state must show for the wallet before the claim is complete.
export const gameMilestoneClaims = platformSchema.table(
  "game_milestone_claims",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    milestoneId: text("milestone_id").notNull(),
    walletAddress: text("wallet_address").notNull(),
    expectedClaims: integer("expected_claims").notNull(),
    ...trackedTransactionColumns,
  },
  (table) => [
    index("game_milestone_claims_player_idx").on(table.userId, table.gameId),
    uniqueIndex("game_milestone_claims_one_in_progress_idx")
      .on(table.userId, table.gameId, table.milestoneId)
      .where(sql`${table.state} not in (${settledStatesSql})`),
    check(
      "game_milestone_claims_expected_positive",
      sql`${table.expectedClaims} >= 1`,
    ),
    ...trackedTransactionChecks("game_milestone_claims", table),
  ],
);
