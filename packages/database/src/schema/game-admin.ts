import { sql } from "drizzle-orm";
import { check, index, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";
import {
  settledStatesSql,
  trackedTransactionChecks,
  trackedTransactionColumns,
} from "./tracked-transaction.ts";

// A step staff took to administer a game's rewards contract (define a milestone, pause or resume claims): who built it and who sent
// it, the transaction built for it and the summary staff were shown, and where it is in the chain's lifecycle. This is the audit
// log of administration: rows are never deleted, and the people stay recorded after their account is gone. At most one step per
// game, operation and milestone is in progress, which makes asking again return the same step.
export const gameAdminSteps = platformSchema.table(
  "game_admin_steps",
  {
    id: uuid("id").primaryKey(),
    gameId: text("game_id").notNull(),
    operation: text("operation").notNull(),
    // The milestone a definition is for; none for a step on the whole game.
    milestoneId: text("milestone_id"),
    // Who built the step and who sent it signed; staff accounts are not deleted, and the log outlives them if they are.
    createdBy: uuid("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    submittedBy: uuid("submitted_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    ...trackedTransactionColumns,
  },
  (table) => [
    index("game_admin_steps_game_idx").on(table.gameId, table.createdAt),
    uniqueIndex("game_admin_steps_one_in_progress_idx")
      .on(
        table.gameId,
        table.operation,
        sql`coalesce(${table.milestoneId}, '')`,
      )
      .where(sql`${table.state} not in (${settledStatesSql})`),
    check(
      "game_admin_steps_operation_known",
      sql`${table.operation} in ('define-milestone', 'set-claims-paused')`,
    ),
    check(
      "game_admin_steps_milestone_coherent",
      sql`(${table.operation} = 'define-milestone') = (${table.milestoneId} is not null)`,
    ),
    ...trackedTransactionChecks("game_admin_steps", table),
  ],
);
