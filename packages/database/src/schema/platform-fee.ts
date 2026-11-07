import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// The platform's fee on milestone claims, as a log of settings: each row is one setting made by staff, and the fee in force on a chain is
// its newest row. Nothing is updated or deleted, so the log is also the history of who set what and when. The fee is whole satoshis (0:
// no fee) and the treasury is the address it is paid to on that chain. The newest row for a chain is one index read.
export const platformFeeSettings = platformSchema.table(
  "platform_fee_settings",
  {
    chain: text("chain").notNull(),
    // Staff accounts are not deleted, and the log outlives them if they are.
    changedBy: uuid("changed_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    feeSats: bigint("fee_sats", { mode: "bigint" }).notNull(),
    id: uuid("id").primaryKey(),
    treasuryAddress: text("treasury_address").notNull(),
  },
  (table) => [
    index("platform_fee_settings_chain_newest_idx").on(
      table.chain,
      table.createdAt.desc(),
    ),
    check("platform_fee_settings_fee_not_negative", sql`${table.feeSats} >= 0`),
  ],
);
