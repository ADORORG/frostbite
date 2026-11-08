import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  primaryKey,
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
// `platform_fee_sats` is the platform's fee the claim's transaction pays (0: none), fixed when the transaction was built, so a later change
// of the fee never rewrites what an earlier claim carried. The per-game report reads from three places, none of which grows with the mints
// it counts: `game_mint_totals` (below) holds completed mints and fees per game, `game_state` finds a game's claims that are still on their
// way, and `game_recent` lists a game's latest completed mints in order, and the next page after a given one, without sorting.
// `collectible_id` is the item the claim minted, once known. `expected_claims` is the count the chain's indexed state must show for the wallet before the claim is complete.
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
    platformFeeSats: bigint("platform_fee_sats", { mode: "bigint" })
      .notNull()
      .default(0n),
    // The collectible the claim's transaction created, in the chain's own notation, learned when the network shows the transaction
    // included; none before that. It is only an address to ask the chain about: what is served for it is checked against the game's
    // contract before anyone is shown it.
    collectibleId: text("collectible_id"),
    ...trackedTransactionColumns,
  },
  (table) => [
    index("game_milestone_claims_player_idx").on(table.userId, table.gameId),
    index("game_milestone_claims_game_state_idx").on(table.gameId, table.state),
    index("game_milestone_claims_game_recent_idx")
      .on(table.gameId, table.updatedAt.desc(), table.id.desc())
      .where(sql`${table.state} = 'complete'`),
    check(
      "game_milestone_claims_platform_fee_not_negative",
      sql`${table.platformFeeSats} >= 0`,
    ),
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

// How many mints each game has completed and the platform fees they carried, kept by triggers on `game_milestone_claims` (see the
// migration that made them): a claim becoming complete adds one and its fee, and one leaving `complete` takes them away. Deleting a
// claim (its player's account was deleted) takes nothing away: the mint happened and the fee was paid on the chain. A game that has had
// no mint has no row.
export const gameMintTotals = platformSchema.table(
  "game_mint_totals",
  {
    completed: bigint("completed", { mode: "number" }).notNull(),
    feesSats: bigint("fees_sats", { mode: "bigint" }).notNull(),
    gameId: text("game_id").primaryKey(),
  },
  (table) => [
    check(
      "game_mint_totals_not_negative",
      sql`${table.completed} >= 0 and ${table.feesSats} >= 0`,
    ),
  ],
);

// How many mints each milestone of each game has completed, kept by triggers on `game_milestone_claims` exactly as `game_mint_totals` is (see
// the migration that made them): a claim becoming complete adds one, and one leaving `complete` takes it away, so reading how many players
// minted a milestone costs a row however many mints there are. Deleting a claim (its player's account was deleted) takes nothing away: the
// mint happened. A milestone whose mints have all left `complete` keeps a row of 0; one never minted has none.
export const gameMilestoneMintTotals = platformSchema.table(
  "game_milestone_mint_totals",
  {
    completed: bigint("completed", { mode: "number" }).notNull(),
    gameId: text("game_id").notNull(),
    milestoneId: text("milestone_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.milestoneId] }),
    check(
      "game_milestone_mint_totals_not_negative",
      sql`${table.completed} >= 0`,
    ),
  ],
);
