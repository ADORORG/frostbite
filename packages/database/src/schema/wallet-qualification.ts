import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { platformSchema } from "./platform.ts";

// Separate from authentication challenges: no identity or session foreign keys.
export const walletQualificationChallenges = platformSchema.table(
  "wallet_qualification_challenges",
  {
    id: uuid("id").primaryKey(),
    address: text("address").notNull(),
    origin: text("origin").notNull(),
    messageHash: text("message_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    check(
      "wallet_qualification_hash_sha256",
      sql`${table.messageHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "wallet_qualification_attempts_nonnegative",
      sql`${table.attempts} >= 0`,
    ),
    index("wallet_qualification_expiry_idx").on(table.expiresAt),
  ],
);
