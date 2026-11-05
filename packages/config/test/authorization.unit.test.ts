import {
  authorizationPolicySchema,
  manageRolesCapability,
} from "@frostbite/shared/accounts";
import { collectionReviewCapability } from "@frostbite/shared/collections";
import { gameAdminCapability } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { authorizationPolicy } from "../src/policy/authorization.ts";

describe("authorization policy", () => {
  it("is valid and separates creator review from platform operations", () => {
    expect(authorizationPolicySchema.parse(authorizationPolicy)).toEqual(
      authorizationPolicy,
    );
    expect(authorizationPolicy.platform.reviewer).toContain("creator:review");
    expect(authorizationPolicy.platform.staff).not.toContain("creator:review");
  });

  it("lets reviewers and administrators, and not staff, decide on collection submissions", () => {
    expect(authorizationPolicy.platform.reviewer).toContain(
      collectionReviewCapability,
    );
    expect(authorizationPolicy.platform.staff).not.toContain(
      collectionReviewCapability,
    );
  });

  it("lets staff and administrators, and not reviewers, administer a game's rewards contract", () => {
    expect(authorizationPolicy.platform.staff).toContain(gameAdminCapability);
    expect(authorizationPolicy.platform.reviewer).not.toContain(
      gameAdminCapability,
    );
  });

  it("gives an administrator everything a staff member or a reviewer may do, and the power to manage roles", () => {
    const { admin, reviewer, staff } = authorizationPolicy.platform;
    for (const capability of [...reviewer, ...staff]) {
      expect(admin).toContain(capability);
    }
    expect(admin).toContain(manageRolesCapability);
    // Staff and reviewers cannot manage roles: only the administrator can.
    expect(staff).not.toContain(manageRolesCapability);
    expect(reviewer).not.toContain(manageRolesCapability);
  });

  it("still holds the administrator to a wallet, since it can now sign game steps, and leaves reviewers free of requirements", () => {
    expect(authorizationPolicy.requiredMethods.admin).toEqual(["wallet"]);
    expect(authorizationPolicy.requiredMethods.staff).toEqual(["wallet"]);
  });
});
