import { sql } from "drizzle-orm";
import { check, index, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { platformSchema } from "./platform.ts";

// The challenge a browser signs to sign in with a passkey. Unlike a registration challenge it belongs to nobody yet: the person is
// not signed in, and which account the passkey opens is learned from the credential that signs it (a discoverable credential). Only
// the hash of the challenge is kept. One attempt per challenge: it is spent when the attempt is made, successful or not.
export const passkeySignInChallenges = platformSchema.table(
  "passkey_sign_in_challenges",
  {
    id: uuid("id").primaryKey(),
    challengeHash: text("challenge_hash").notNull(),
    origin: text("origin").notNull(),
    relyingPartyId: text("relying_party_id").notNull(),
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
    check(
      "passkey_sign_in_challenges_hash_sha256",
      sql`${table.challengeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "passkey_sign_in_challenges_expiry_after_issue",
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),
    index("passkey_sign_in_challenges_expiry_idx").on(table.expiresAt),
  ],
);

export type PasskeySignInChallenge =
  typeof passkeySignInChallenges.$inferSelect;
