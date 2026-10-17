import { sql } from "drizzle-orm";
import { check, index, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";
import {
  settledStatesSql,
  trackedTransactionChecks,
  trackedTransactionColumns,
} from "./tracked-transaction.ts";

// A step staff took to administer the platform's rewards contracts: publish a template, create a game's contract, define a milestone,
// pause or resume claims. It records who built it and who sent it, the transaction built for it and the summary staff were shown,
// and where it is in the chain's lifecycle. This is the audit log of administration: rows are never deleted, and the people stay
// recorded after their account is gone. A step is about one game, or (publishing a template) about one template for every game.
// At most one step per game, template, operation and milestone is in progress, which makes asking again return the same step.
export const gameAdminSteps = platformSchema.table(
  "game_admin_steps",
  {
    id: uuid("id").primaryKey(),
    gameId: text("game_id"),
    operation: text("operation").notNull(),
    // The template a publication is for, as `id@version`; none for a step on a game.
    templateRef: text("template_ref"),
    // The milestone a definition is for; none for a step on the whole game.
    milestoneId: text("milestone_id"),
    // Who built the step and who sent it signed; staff accounts are not deleted, and the log outlives them if they are.
    createdBy: uuid("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    submittedBy: uuid("submitted_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    // Who entered the address of a contract the chain did not report, when staff had to; none when the chain reported it.
    recordedBy: uuid("recorded_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    ...trackedTransactionColumns,
    // The contract the step acts on. Publishing a template and creating a game act on none yet.
    contractFamily: text("contract_family"),
    contractId: text("contract_id"),
    // What the chain reported the step created, in the chain's notation: where a new game's contract is, once it is made.
    createdContracts: text("created_contracts").array(),
  },
  (table) => [
    index("game_admin_steps_game_idx").on(table.gameId, table.createdAt),
    uniqueIndex("game_admin_steps_one_in_progress_idx")
      .on(
        sql`coalesce(${table.gameId}, '')`,
        table.operation,
        sql`coalesce(${table.milestoneId}, '')`,
        sql`coalesce(${table.templateRef}, '')`,
      )
      .where(sql`${table.state} not in (${settledStatesSql})`),
    check(
      "game_admin_steps_operation_known",
      sql`${table.operation} in ('define-milestone', 'set-claims-paused', 'publish-template', 'deploy')`,
    ),
    check(
      "game_admin_steps_subject_coherent",
      sql`(${table.operation} = 'publish-template') = (${table.templateRef} is not null) and (${table.operation} = 'publish-template') = (${table.gameId} is null)`,
    ),
    check(
      "game_admin_steps_contract_coherent",
      sql`(${table.contractFamily} is null) = (${table.contractId} is null) and (${table.operation} in ('define-milestone', 'set-claims-paused')) = (${table.contractId} is not null)`,
    ),
    check(
      "game_admin_steps_milestone_coherent",
      sql`(${table.operation} = 'define-milestone') = (${table.milestoneId} is not null)`,
    ),
    ...trackedTransactionChecks("game_admin_steps", table),
  ],
);
