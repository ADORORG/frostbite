import { getTableConfig } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  authSessions,
  authSecurityEvents,
  authUsers,
  passkeyChallenges,
  passkeyCredentials,
  releasedWallets,
  walletChallenges,
  walletIdentities,
} from "../src/index.ts";

function names(values: readonly { readonly name?: string }[]): string[] {
  return values.flatMap((value) => value.name ?? []);
}

function indexNames(
  values: readonly { readonly config: { readonly name?: string } }[],
): string[] {
  return values.flatMap((value) => value.config.name ?? []);
}

function referencedTables(config: ReturnType<typeof getTableConfig>): string[] {
  return config.foreignKeys.map((key) =>
    getTableName(key.reference().foreignTable),
  );
}

describe("authentication schema", () => {
  it("defines session hash, lifecycle, and ownership constraints", () => {
    const config = getTableConfig(authSessions);
    expect(indexNames(config.indexes)).toEqual(
      expect.arrayContaining([
        "auth_sessions_token_hash_unique",
        "auth_sessions_user_id_idx",
      ]),
    );
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "auth_sessions_idle_before_absolute",
        "auth_sessions_token_hash_sha256",
      ]),
    );
    expect(config.foreignKeys).toHaveLength(1);
    expect(referencedTables(config)).toEqual(["auth_users"]);
    expect(config.columns.map((column) => column.name)).toContain(
      "authenticated_at",
    );
  });

  it("constrains passkey challenges, credentials, and immutable audit evidence", () => {
    const challenges = getTableConfig(passkeyChallenges);
    expect(names(challenges.checks)).toEqual(
      expect.arrayContaining([
        "passkey_challenges_hash_sha256",
        "passkey_challenges_expiry_after_create",
      ]),
    );
    expect(referencedTables(challenges)).toEqual([
      "auth_users",
      "auth_sessions",
    ]);
    const credentials = getTableConfig(passkeyCredentials);
    expect(names(credentials.checks)).toEqual(
      expect.arrayContaining([
        "passkey_credentials_counter_nonnegative",
        "passkey_credentials_id_base64url",
        "passkey_credentials_public_key_nonempty",
        "passkey_credentials_device_type_supported",
      ]),
    );
    expect(indexNames(credentials.indexes)).toContain(
      "passkey_credentials_credential_id_unique",
    );
    const events = getTableConfig(authSecurityEvents);
    expect(names(events.checks)).toContain(
      "auth_security_events_credential_fingerprint_sha256",
    );
    expect(referencedTables(events)).toEqual(["auth_users", "auth_sessions"]);
  });

  it("defines wallet identity uniqueness and supported-value checks", () => {
    const config = getTableConfig(walletIdentities);
    expect(indexNames(config.indexes)).toContain(
      "wallet_identities_network_script_unique",
    );
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "wallet_identities_network_supported",
        "wallet_identities_adapter_nonempty",
      ]),
    );
    expect(config.foreignKeys).toHaveLength(1);
    expect(referencedTables(config)).toEqual(["auth_users"]);
  });

  it("defines single-use challenge indexes, checks, and user ownership", () => {
    const config = getTableConfig(walletChallenges);
    expect(indexNames(config.indexes)).toEqual(
      expect.arrayContaining([
        "wallet_challenges_nonce_unique",
        "wallet_challenges_expiry_idx",
      ]),
    );
    expect(names(config.checks)).toEqual(
      expect.arrayContaining([
        "wallet_challenges_attempts_nonnegative",
        "wallet_challenges_expiry_after_issue",
        "wallet_challenges_network_supported",
        "wallet_challenges_signature_scheme_supported",
        "wallet_challenges_schema_version_supported",
        "wallet_challenges_message_hash_sha256",
      ]),
    );
    expect(config.foreignKeys).toHaveLength(1);
    expect(referencedTables(config)).toEqual(["auth_users"]);
  });

  it("keeps wallet users independent of provider-specific tables", () => {
    const config = getTableConfig(authUsers);
    expect(config.name).toBe("auth_users");
    expect(config.schema).toBe("ador");
    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["id", "email", "email_verified"]),
    );
  });

  it("holds a released wallet once, for a bounded time, and goes with the account that released it", () => {
    const config = getTableConfig(releasedWallets);
    expect(indexNames(config.indexes)).toEqual([
      "released_wallets_network_script_unique",
    ]);
    expect(names(config.checks)).toEqual([
      "released_wallets_network_supported",
      "released_wallets_hold_after_release",
    ]);
    expect(referencedTables(config)).toEqual(["auth_users"]);
    expect(config.foreignKeys.map((key) => key.onDelete)).toEqual(["cascade"]);
  });
});
