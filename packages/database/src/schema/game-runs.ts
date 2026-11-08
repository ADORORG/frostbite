import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// A run of a game that the platform issued to a signed-in player, so the result can be checked: its seed (the platform's, not
// the player's), the digest of the game's replay verifier when it was issued (so a later release cannot change what the run is
// checked against), and how it ended. It moves one way: `issued` -> `submitted` (with a verdict) or `expired`. A run is
// submitted at most once, which is what the row lock in the repository guarantees; the record the player sent is kept as
// canonical text so a verdict can be audited, within the SDK's 64 KB ceiling.
export const gameRuns = platformSchema.table(
  "game_runs",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    verifierDigest: text("verifier_digest").notNull(),
    // 32 bits, so every engine reproduces it; a bigint holds the top of the range.
    seed: bigint("seed", { mode: "number" }).notNull(),
    state: text("state").notNull().default("issued"),
    issuedAt: timestamp("issued_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    submittedAt: timestamp("submitted_at", {
      mode: "date",
      withTimezone: true,
    }),
    verdict: text("verdict"),
    verdictReason: text("verdict_reason"),
    earned: jsonb("earned"),
    recordDigest: text("record_digest"),
    recordText: text("record_text"),
    // What the replay scored, for a verified run of a game that keeps a score and when the run had ended. This is the number a board ranks:
    // it comes from the platform's replay of the record, never from the record or the game.
    score: bigint("score", { mode: "number" }),
  },
  (table) => [
    // The open runs of a player in a game are counted on every start.
    index("game_runs_open_idx").on(table.userId, table.gameId, table.state),
    // A board is a game's best verified scores, highest first.
    index("game_runs_board_idx")
      .on(table.gameId, table.score.desc())
      .where(sql`${table.score} is not null`),
    check(
      "game_runs_state_known",
      sql`${table.state} in ('issued', 'submitted', 'expired')`,
    ),
    check(
      "game_runs_seed_32_bits",
      sql`${table.seed} between 0 and 4294967295`,
    ),
    check(
      "game_runs_expiry_after_issue",
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),
    check(
      "game_runs_verdict_known",
      sql`${table.verdict} is null or ${table.verdict} in ('verified', 'rejected')`,
    ),
    // A verdict, a submission time and a state of `submitted` come together, and only together.
    check(
      "game_runs_submitted_coherent",
      sql`(${table.state} = 'submitted') = (${table.verdict} is not null) and (${table.state} = 'submitted') = (${table.submittedAt} is not null)`,
    ),
    check(
      "game_runs_record_bounded",
      sql`${table.recordText} is null or char_length(${table.recordText}) <= 65536`,
    ),
    // Only a verified run has a score, and a score is never negative.
    check(
      "game_runs_score_coherent",
      sql`${table.score} is null or (${table.verdict} is not distinct from 'verified' and ${table.score} >= 0)`,
    ),
    check(
      "game_runs_digest_shape",
      sql`${table.verifierDigest} ~ '^[0-9a-f]{64}$' and (${table.recordDigest} is null or ${table.recordDigest} ~ '^[0-9a-f]{64}$')`,
    ),
  ],
);
