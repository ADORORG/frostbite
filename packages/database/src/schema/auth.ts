import { sql } from "drizzle-orm";
import { walletAuthActions } from "@frostbite/shared/auth";
import {
  bigint,
  bytea,
  boolean,
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { networkInList } from "./network-check.ts";
import { platformSchema } from "./platform.ts";

function timestamps() {
  return {
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}

export const authUsers = platformSchema.table("auth_users", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps(),
});

export const authSessions = platformSchema.table(
  "auth_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    authenticatedAt: timestamp("authenticated_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_user_id_idx").on(table.userId),
    check(
      "auth_sessions_idle_before_absolute",
      sql`${table.idleExpiresAt} <= ${table.absoluteExpiresAt}`,
    ),
    check(
      "auth_sessions_token_hash_sha256",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const walletIdentities = platformSchema.table(
  "wallet_identities",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    network: text("network").notNull(),
    address: text("address").notNull(),
    scriptIdentity: text("script_identity").notNull(),
    walletAdapter: text("wallet_adapter").notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("wallet_identities_network_script_unique").on(
      table.network,
      table.scriptIdentity,
    ),
    index("wallet_identities_user_id_idx").on(table.userId),
    check("wallet_identities_network_supported", networkInList(table.network)),
    check(
      "wallet_identities_adapter_nonempty",
      sql`length(${table.walletAdapter}) > 0 and ${table.walletAdapter} = btrim(${table.walletAdapter})`,
    ),
  ],
);

export const authChallengeAction = platformSchema.enum(
  "auth_challenge_action",
  walletAuthActions,
);

export const authSecurityAction = platformSchema.enum("auth_security_action", [
  "email-linked",
  "email-unlinked",
  "passkey-linked",
  "passkey-unlinked",
  "wallet-linked",
  "wallet-unlinked",
]);

export const walletChallenges = platformSchema.table(
  "wallet_challenges",
  {
    id: uuid("id").primaryKey(),
    expectedUserId: uuid("expected_user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    action: authChallengeAction("action").notNull(),
    address: text("address").notNull(),
    scriptIdentity: text("script_identity").notNull(),
    network: text("network").notNull(),
    domain: text("domain").notNull(),
    origin: text("origin").notNull(),
    uri: text("uri").notNull(),
    walletAdapter: text("wallet_adapter").notNull(),
    signatureScheme: text("signature_scheme").notNull(),
    nonce: text("nonce").notNull(),
    requestId: uuid("request_id").notNull(),
    messageHash: text("message_hash").notNull(),
    schemaVersion: integer("schema_version").notNull(),
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
    uniqueIndex("wallet_challenges_nonce_unique").on(table.nonce),
    check(
      "wallet_challenges_attempts_nonnegative",
      sql`${table.attempts} >= 0`,
    ),
    check(
      "wallet_challenges_expiry_after_issue",
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),
    check("wallet_challenges_network_supported", networkInList(table.network)),
    check(
      "wallet_challenges_signature_scheme_supported",
      sql`${table.signatureScheme} = 'bip322-simple'`,
    ),
    check(
      "wallet_challenges_schema_version_supported",
      sql`${table.schemaVersion} = 1`,
    ),
    check(
      "wallet_challenges_message_hash_sha256",
      sql`${table.messageHash} ~ '^[0-9a-f]{64}$'`,
    ),
    index("wallet_challenges_expiry_idx").on(table.expiresAt),
  ],
);

export const passkeyChallenges = platformSchema.table(
  "passkey_challenges",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => authSessions.id, { onDelete: "cascade" }),
    challengeHash: text("challenge_hash").notNull(),
    origin: text("origin").notNull(),
    relyingPartyId: text("relying_party_id").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp("consumed_at", { mode: "date", withTimezone: true }),
    issuedAt: timestamp("issued_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    check(
      "passkey_challenges_hash_sha256",
      sql`${table.challengeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "passkey_challenges_expiry_after_create",
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),
    index("passkey_challenges_expiry_idx").on(table.expiresAt),
  ],
);

export const passkeyCredentials = platformSchema.table(
  "passkey_credentials",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull(),
    publicKey: bytea("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports").array().notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("passkey_credentials_credential_id_unique").on(
      table.credentialId,
    ),
    index("passkey_credentials_user_id_idx").on(table.userId),
    check(
      "passkey_credentials_counter_nonnegative",
      sql`${table.counter} between 0 and 9007199254740991`,
    ),
    check(
      "passkey_credentials_id_base64url",
      sql`${table.credentialId} ~ '^[A-Za-z0-9_-]+$'`,
    ),
    check(
      "passkey_credentials_public_key_nonempty",
      sql`octet_length(${table.publicKey}) > 0`,
    ),
    check(
      "passkey_credentials_device_type_supported",
      sql`${table.deviceType} in ('multiDevice', 'singleDevice')`,
    ),
  ],
);

export const authSecurityEvents = platformSchema.table(
  "auth_security_events",
  {
    id: uuid("id").primaryKey(),
    action: authSecurityAction("action").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => authSessions.id, { onDelete: "restrict" }),
    credentialFingerprint: text("credential_fingerprint").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auth_security_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    check(
      "auth_security_events_credential_fingerprint_sha256",
      sql`${table.credentialFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export type AuthUser = typeof authUsers.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type WalletIdentity = typeof walletIdentities.$inferSelect;
export type WalletChallenge = typeof walletChallenges.$inferSelect;
export type PasskeyChallenge = typeof passkeyChallenges.$inferSelect;
export type PasskeyCredential = typeof passkeyCredentials.$inferSelect;
export type AuthSecurityEvent = typeof authSecurityEvents.$inferSelect;
