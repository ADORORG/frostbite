import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";

// A way of being reached that proves a person to the platform: an email address today, a phone number later. The kind and the
// normalized value are the identity, so one address belongs to one account for good (ADR-021 point 5: no merging). `auth_users.email`
// is not an identity and is never read for sign-in.
export const contactIdentities = platformSchema.table(
  "contact_identities",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    value: text("value").notNull(),
    // When a code sent to the value was first entered correctly.
    verifiedAt: timestamp("verified_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("contact_identities_kind_value_unique").on(
      table.kind,
      table.value,
    ),
    index("contact_identities_user_id_idx").on(table.userId),
    check(
      "contact_identities_kind_valid",
      sql`${table.kind} ~ '^[a-z][a-z0-9-]*$'`,
    ),
    check(
      "contact_identities_value_nonempty",
      sql`btrim(${table.value}) <> ''`,
    ),
  ],
);

// A one-time code sent to a contact. Only a salted hash of the code is kept. A newer code for the same destination replaces the
// older ones (they are marked used), a code is used once, and each try at it counts, right or wrong.
export const contactCodes = platformSchema.table(
  "contact_codes",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").notNull(),
    destination: text("destination").notNull(),
    codeHash: text("code_hash").notNull(),
    salt: text("salt").notNull(),
    attempts: integer("attempts").notNull().default(0),
    issuedAt: timestamp("issued_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("contact_codes_destination_issued_idx").on(
      table.kind,
      table.destination,
      table.issuedAt,
    ),
    index("contact_codes_expiry_idx").on(table.expiresAt),
    check("contact_codes_attempts_nonnegative", sql`${table.attempts} >= 0`),
    check(
      "contact_codes_hash_sha256",
      sql`${table.codeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "contact_codes_expiry_after_issue",
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),
    check("contact_codes_salt_nonempty", sql`${table.salt} <> ''`),
  ],
);

export type ContactIdentity = typeof contactIdentities.$inferSelect;
export type ContactCode = typeof contactCodes.$inferSelect;
