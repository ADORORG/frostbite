import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { contactCodes, contactIdentities } from "../src/index.ts";

const names = (config: ReturnType<typeof getTableConfig>) => ({
  checks: config.checks.map((check) => check.name).sort(),
  indexes: config.indexes.flatMap((value) => value.config.name ?? []).sort(),
});

describe("contact identity schema", () => {
  it("makes one address (a kind and its value) belong to one account, with the checks the table enforces itself", () => {
    const config = getTableConfig(contactIdentities);
    expect(names(config)).toEqual({
      checks: [
        "contact_identities_kind_valid",
        "contact_identities_value_nonempty",
      ],
      indexes: [
        "contact_identities_kind_value_unique",
        "contact_identities_user_id_idx",
      ],
    });
    expect(
      config.foreignKeys.map((key) =>
        getTableName(key.reference().foreignTable),
      ),
    ).toEqual(["auth_users"]);
    expect(config.foreignKeys.map((key) => key.onDelete)).toEqual(["cascade"]);
  });
});

describe("contact code schema", () => {
  it("keeps a code's hash, salt, tries and times to rules of its own, and looks codes up by destination", () => {
    const config = getTableConfig(contactCodes);
    expect(names(config)).toEqual({
      checks: [
        "contact_codes_attempts_nonnegative",
        "contact_codes_expiry_after_issue",
        "contact_codes_hash_sha256",
        "contact_codes_salt_nonempty",
      ],
      indexes: [
        "contact_codes_destination_issued_idx",
        "contact_codes_expiry_idx",
      ],
    });
    expect(config.foreignKeys).toEqual([]);
  });
});
