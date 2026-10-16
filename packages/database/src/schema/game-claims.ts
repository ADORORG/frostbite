import { transactionStates } from "@ador/shared/chain";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// The states of a claim are the neutral transaction states (ADR-017 section 5), and `expired` for a claim built and never
// signed in time. Listed from the one definition, so a state added there is a state here.
const quote = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(", "));
const states = quote([...transactionStates, "expired"]);
// A claim in one of these is over: it either took effect or never will. Any other is in progress.
const settled = quote([
  "broadcast_rejected",
  "complete",
  "expired",
  "indexed_failure",
]);

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
    chain: text("chain").notNull(),
    walletAddress: text("wallet_address").notNull(),
    contractFamily: text("contract_family").notNull(),
    contractId: text("contract_id").notNull(),
    expectedClaims: integer("expected_claims").notNull(),
    state: text("state").notNull(),
    // What was built: the adapter's family, format and opaque payload, and the summary the person was shown.
    unsignedFamily: text("unsigned_family").notNull(),
    unsignedFormat: text("unsigned_format").notNull(),
    unsignedPayload: text("unsigned_payload").notNull(),
    summary: jsonb("summary").notNull(),
    signedPayload: text("signed_payload"),
    transactionId: text("transaction_id"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("game_milestone_claims_player_idx").on(table.userId, table.gameId),
    uniqueIndex("game_milestone_claims_one_in_progress_idx")
      .on(table.userId, table.gameId, table.milestoneId)
      .where(sql`${table.state} not in (${settled})`),
    check(
      "game_milestone_claims_state_known",
      sql`${table.state} in (${states})`,
    ),
    check(
      "game_milestone_claims_expected_positive",
      sql`${table.expectedClaims} >= 1`,
    ),
    check(
      "game_milestone_claims_payload_bounded",
      sql`char_length(${table.unsignedPayload}) <= 65536 and (${table.signedPayload} is null or char_length(${table.signedPayload}) <= 65536)`,
    ),
    // The signed transaction exists from the moment the claim is signed, and the network's id for it from the moment the
    // network answered; a claim that failed says why, and no other claim has a reason.
    check(
      "game_milestone_claims_signed_coherent",
      sql`(${table.state} in ('constructed', 'simulated', 'awaiting_signature', 'expired')) = (${table.signedPayload} is null)`,
    ),
    check(
      "game_milestone_claims_transaction_coherent",
      sql`(${table.state} in ('constructed', 'simulated', 'awaiting_signature', 'signed', 'expired', 'broadcast_rejected')) = (${table.transactionId} is null)`,
    ),
    check(
      "game_milestone_claims_failure_coherent",
      sql`(${table.state} in ('broadcast_rejected', 'indexed_failure')) = (${table.failureReason} is not null)`,
    ),
  ],
);
