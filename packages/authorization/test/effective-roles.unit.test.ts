import { describe, expect, it } from "vitest";

import {
  effectiveRoles,
  requiresMethods,
} from "../src/application/effective-roles.ts";

describe("which of an account's roles work", () => {
  const requirements = { admin: ["wallet"], staff: ["wallet", "passkey"] };

  it("keeps a role that needs nothing, whatever the account holds", () => {
    expect(effectiveRoles(["reviewer"], new Set(), requirements)).toEqual([
      "reviewer",
    ]);
  });

  it("keeps a role only when the account holds every kind it needs", () => {
    expect(
      effectiveRoles(["admin", "staff"], new Set(["wallet"]), requirements),
    ).toEqual(["admin"]);
    expect(
      effectiveRoles(
        ["admin", "staff"],
        new Set(["wallet", "passkey"]),
        requirements,
      ),
    ).toEqual(["admin", "staff"]);
    expect(effectiveRoles(["admin", "staff"], new Set(), requirements)).toEqual(
      [],
    );
  });

  it("treats a kind it has never heard of like any other, and an empty list of needs as no need", () => {
    expect(
      effectiveRoles(["admin"], new Set(["phone"]), { admin: ["phone"] }),
    ).toEqual(["admin"]);
    expect(effectiveRoles(["admin"], new Set(), { admin: [] })).toEqual([
      "admin",
    ]);
    expect(effectiveRoles([], new Set(["wallet"]), requirements)).toEqual([]);
  });

  it("says whether a role needs any method at all", () => {
    expect(requiresMethods("admin", requirements)).toBe(true);
    expect(requiresMethods("reviewer", requirements)).toBe(false);
    expect(requiresMethods("admin", { admin: [] })).toBe(false);
  });
});
