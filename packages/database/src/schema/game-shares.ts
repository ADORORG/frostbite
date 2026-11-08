import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// What a player chose to share: a link, `/s/<id>`, to a public page that shows one thing they earned. The row is the link's
// authority, so a shared page can only show what the platform checked when the player pressed Share: a milestone they hold (with
// the level the account has for it) or a score they reported (always `self-reported`: no replay verifier returns a score).
// Nothing personal is kept: the owner is only for the player's own list and for attributing a link later, and the public page never
// shows it. `id` is the link, random and unguessable. A revoked share answers as if it never existed. Sharing the same thing twice
// gives the same link: one live row per player and thing, which the partial indexes below enforce.
export const gameShares = platformSchema.table(
  "game_shares",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    gameId: text("game_id"),
    milestoneId: text("milestone_id"),
    // The score as it was when shared, so a card never changes under a link already posted.
    score: bigint("score", { mode: "number" }),
    // `replay-verified` or `self-reported` (the two levels a milestone has on the account), copied when shared, never from the request.
    verification: text("verification"),
    createdAt: timestamp("created_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    check(
      "game_shares_shape",
      sql`(${table.kind} = 'milestones' and ${table.gameId} is null and ${table.milestoneId} is null and ${table.score} is null and ${table.verification} is null)
        or (${table.kind} = 'milestone' and ${table.gameId} is not null and ${table.milestoneId} is not null and ${table.score} is null and ${table.verification} in ('replay-verified', 'self-reported'))
        or (${table.kind} = 'score' and ${table.gameId} is not null and ${table.milestoneId} is null and ${table.score} >= 0 and ${table.verification} = 'self-reported')`,
    ),
    check(
      "game_shares_revoked_after_created",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`,
    ),
    uniqueIndex("game_shares_live_milestones_idx")
      .on(table.userId)
      .where(sql`${table.kind} = 'milestones' and ${table.revokedAt} is null`),
    uniqueIndex("game_shares_live_milestone_idx")
      .on(table.userId, table.gameId, table.milestoneId)
      .where(sql`${table.kind} = 'milestone' and ${table.revokedAt} is null`),
    uniqueIndex("game_shares_live_score_idx")
      .on(table.userId, table.gameId, table.score)
      .where(sql`${table.kind} = 'score' and ${table.revokedAt} is null`),
  ],
);
