import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { gameAdminSteps } from "./game-admin.ts";
import { platformSchema } from "./platform.ts";

// Where on a chain each template the platform published is, learned when the step that published it completed. A template is
// published once per chain and version; the address never changes, and a game's contract is made from it.
export const publishedTemplates = platformSchema.table(
  "published_templates",
  {
    address: text("address").notNull(),
    chain: text("chain").notNull(),
    codeHash: text("code_hash").notNull(),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    // The step that published it, kept as the evidence.
    stepId: uuid("step_id")
      .notNull()
      .references(() => gameAdminSteps.id, { onDelete: "restrict" }),
    // `id@version`.
    templateRef: text("template_ref").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chain, table.templateRef] }),
    uniqueIndex("published_templates_address_idx").on(
      table.chain,
      table.address,
    ),
    check(
      "published_templates_code_hash_shape",
      sql`${table.codeHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

// The rewards contract of each game on a chain, learned when the step that created it completed. A game has one per chain; its
// address never changes. Claims and administration both read it from here.
export const gameContracts = platformSchema.table(
  "game_contracts",
  {
    address: text("address").notNull(),
    chain: text("chain").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    family: text("family").notNull(),
    gameId: text("game_id").notNull(),
    // The largest drawing the contract was created to accept.
    maxDrawingBytes: integer("max_drawing_bytes").notNull(),
    stepId: uuid("step_id")
      .notNull()
      .references(() => gameAdminSteps.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.chain] }),
    uniqueIndex("game_contracts_address_idx").on(table.chain, table.address),
    check(
      "game_contracts_max_drawing_bytes_positive",
      sql`${table.maxDrawingBytes} > 0`,
    ),
  ],
);
