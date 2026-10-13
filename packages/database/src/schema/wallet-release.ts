import { sql } from "drizzle-orm";
import { check, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// A wallet an account removed, held for a while before another account may take it, so a wallet cannot be moved
// between accounts in one step. The account that removed it may link it again at once. One row per wallet: a later
// release replaces the earlier one.
export const releasedWallets = platformSchema.table(
  "released_wallets",
  {
    id: uuid("id").primaryKey(),
    network: text("network").notNull(),
    scriptIdentity: text("script_identity").notNull(),
    previousUserId: uuid("previous_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    releasedAt: timestamp("released_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    heldUntil: timestamp("held_until", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("released_wallets_network_script_unique").on(
      table.network,
      table.scriptIdentity,
    ),
    check(
      "released_wallets_network_supported",
      sql`${table.network} in ('mainnet', 'signet')`,
    ),
    check(
      "released_wallets_hold_after_release",
      sql`${table.heldUntil} > ${table.releasedAt}`,
    ),
  ],
);

export type ReleasedWallet = typeof releasedWallets.$inferSelect;
