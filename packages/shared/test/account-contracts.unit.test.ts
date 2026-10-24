import { describe, expect, it } from "vitest";

import {
  authorizationPolicySchema,
  accountReasonCodeSchema,
  capabilitySchema,
  organizationRoles,
  platformRoles,
} from "../src/accounts/contracts.ts";

const policy = {
  organization: {
    admin: ["organization:members"],
    analyst: ["organization:read"],
    editor: ["organization:edit"],
    owner: ["organization:ownership"],
  },
  platform: {
    admin: [],
    reviewer: ["creator:review"],
    staff: ["platform:operate"],
  },
  requiredMethods: {},
  version: "test-v1",
};

describe("account contracts", () => {
  it("keeps organization and platform roles separate", () => {
    expect(organizationRoles).toEqual(["owner", "admin", "editor", "analyst"]);
    expect(platformRoles).toEqual(["reviewer", "staff", "admin"]);
  });

  it("validates a complete versioned capability policy", () => {
    expect(authorizationPolicySchema.parse(policy)).toEqual(policy);
    expect(
      authorizationPolicySchema.safeParse({
        ...policy,
        organization: { owner: [] },
      }).success,
    ).toBe(false);
  });

  it("rejects unnamespaced or oversized capabilities", () => {
    expect(capabilitySchema.safeParse("approve").success).toBe(false);
    expect(capabilitySchema.safeParse(`scope:${"x".repeat(96)}`).success).toBe(
      false,
    );
  });

  it("accepts structured audit reasons and rejects free text", () => {
    expect(accountReasonCodeSchema.safeParse("owner-transfer").success).toBe(
      true,
    );
    expect(
      accountReasonCodeSchema.safeParse("Owner transfer because...").success,
    ).toBe(false);
  });
});
