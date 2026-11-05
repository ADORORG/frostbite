import type {
  AuthorizationPolicy,
  PlatformRole,
} from "@frostbite/shared/accounts";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import type { AuthorizationRepository } from "../src/application/repository.ts";
import { createAuthorizationService } from "../src/application/service.ts";

const policy: AuthorizationPolicy = {
  organization: {
    admin: ["organization:members"],
    analyst: ["organization:read"],
    editor: ["organization:edit"],
    owner: ["organization:ownership", "organization:members"],
  },
  platform: {
    admin: [],
    reviewer: ["creator:review"],
    staff: ["platform:operate"],
  },
  requiredMethods: {},
  version: "test-v1",
};

function repository(input: {
  readonly membershipStatus?: "active" | "suspended";
  readonly missingMembership?: boolean;
  readonly organizationStatus?: "active" | "suspended";
  readonly heldKinds?: readonly string[];
  readonly platformRoles?: readonly PlatformRole[];
  readonly role?: "owner" | "admin" | "editor" | "analyst";
}): AuthorizationRepository {
  return {
    findOrganizationAccess: async () =>
      input.missingMembership
        ? null
        : {
            membershipStatus: input.membershipStatus ?? "active",
            organizationStatus: input.organizationStatus ?? "active",
            role: input.role ?? "analyst",
          },
    findHeldMethodKinds: async () => new Set(input.heldKinds ?? []),
    findPlatformRoles: async () => input.platformRoles ?? [],
  };
}

const userId = createUuidV7();
const organizationId = createUuidV7();

describe("authorization service", () => {
  it("allows only capabilities assigned to the active organization role", async () => {
    const service = createAuthorizationService({
      policy,
      repository: repository({}),
    });
    await expect(
      service.forOrganization({
        capability: "organization:read",
        organizationId,
        userId,
      }),
    ).resolves.toEqual({ allowed: true, policyVersion: "test-v1" });
    await expect(
      service.forOrganization({
        capability: "organization:edit",
        organizationId,
        userId,
      }),
    ).resolves.toEqual({ allowed: false, policyVersion: "test-v1" });
  });

  it.each([
    { missingMembership: true },
    { membershipStatus: "suspended" as const },
    { organizationStatus: "suspended" as const },
  ])("denies inactive organization access", async (state) => {
    const service = createAuthorizationService({
      policy,
      repository: repository(state),
    });
    await expect(
      service.forOrganization({
        capability: "organization:read",
        organizationId,
        userId,
      }),
    ).resolves.toEqual({ allowed: false, policyVersion: "test-v1" });
  });

  it("keeps platform capabilities separate from organization roles", async () => {
    const service = createAuthorizationService({
      policy,
      repository: repository({ platformRoles: ["reviewer"] }),
    });
    await expect(
      service.forPlatform({ capability: "creator:review", userId }),
    ).resolves.toEqual({ allowed: true, policyVersion: "test-v1" });
    await expect(
      service.forPlatform({ capability: "platform:operate", userId }),
    ).resolves.toEqual({ allowed: false, policyVersion: "test-v1" });
  });

  it("denies malformed capabilities without repository access", async () => {
    let called = false;
    const service = createAuthorizationService({
      policy,
      repository: {
        findOrganizationAccess: async () => {
          called = true;
          return null;
        },
        findHeldMethodKinds: async () => {
          called = true;
          return new Set();
        },
        findPlatformRoles: async () => {
          called = true;
          return [];
        },
      },
    });
    await expect(
      service.forOrganization({
        capability: "invalid",
        organizationId,
        userId,
      }),
    ).resolves.toEqual({ allowed: false, policyVersion: "test-v1" });
    await expect(
      service.forPlatform({ capability: "invalid", userId }),
    ).resolves.toEqual({ allowed: false, policyVersion: "test-v1" });
    expect(called).toBe(false);
  });

  describe("a role that needs a sign-in method", () => {
    const needsWallet: AuthorizationPolicy = {
      ...policy,
      platform: {
        ...policy.platform,
        admin: ["platform:manage-roles"],
      },
      requiredMethods: { admin: ["wallet"], staff: ["wallet"] },
    };
    const forPlatform = (
      heldKinds: readonly string[],
      platformRoles: readonly PlatformRole[],
      capability = "platform:operate",
    ) =>
      createAuthorizationService({
        policy: needsWallet,
        repository: repository({ heldKinds, platformRoles }),
      }).forPlatform({ capability, userId });

    it("works while the account holds the method, and not before", async () => {
      expect((await forPlatform(["wallet"], ["staff"])).allowed).toBe(true);
      expect((await forPlatform([], ["staff"])).allowed).toBe(false);
      expect((await forPlatform(["email", "passkey"], ["staff"])).allowed).toBe(
        false,
      );
    });

    it("holds for the administrator role too", async () => {
      const manage = "platform:manage-roles";
      expect((await forPlatform(["wallet"], ["admin"], manage)).allowed).toBe(
        true,
      );
      expect((await forPlatform([], ["admin"], manage)).allowed).toBe(false);
    });

    it("lets a role that needs nothing work without the method, while one that needs it does not", async () => {
      const both = await forPlatform(
        [],
        ["reviewer", "staff"],
        "creator:review",
      );
      expect(both.allowed).toBe(true);
      const staffOnly = await forPlatform([], ["reviewer", "staff"]);
      expect(staffOnly.allowed).toBe(false);
    });

    it("does not look at the account's methods when none of its roles needs one", async () => {
      let asked = false;
      const service = createAuthorizationService({
        policy: needsWallet,
        repository: {
          ...repository({ platformRoles: ["reviewer"] }),
          findHeldMethodKinds: async () => {
            asked = true;
            return new Set();
          },
        },
      });
      await service.forPlatform({ capability: "creator:review", userId });
      expect(asked).toBe(false);
    });
  });
});
