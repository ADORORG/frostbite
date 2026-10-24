import type { AuthorizationPolicy } from "@ador/shared/accounts";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import type { AccountRepository } from "../src/application/account-repository.ts";
import { createAccountService } from "../src/application/account-service.ts";

const policy: AuthorizationPolicy = {
  organization: {
    admin: ["organization:members"],
    analyst: [],
    editor: [],
    owner: ["organization:members"],
  },
  platform: { admin: [], reviewer: [], staff: [] },
  requiredMethods: {},
  version: "test-v1",
};

function repository(): AccountRepository {
  return {
    changeMembership: vi.fn(async () => ({ kind: "changed" as const })),
    createOrganization: vi.fn(async () => undefined),
  };
}

describe("account service", () => {
  it("normalizes a valid organization name before persistence", async () => {
    const store = repository();
    const service = createAccountService({
      clock: () => new Date("2026-09-09T02:00:00.000Z"),
      membershipCapability: "organization:members",
      policy,
      repository: store,
    });
    const result = await service.createOrganization({
      actorUserId: createUuidV7(),
      correlationId: createUuidV7(),
      name: "  Example  ",
    });
    expect(result).not.toBeNull();
    expect(store.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Example", policyVersion: "test-v1" }),
    );
  });

  it("rejects invalid names and reasons before persistence", async () => {
    const store = repository();
    const service = createAccountService({
      clock: () => new Date(),
      membershipCapability: "organization:members",
      policy,
      repository: store,
    });
    await expect(
      service.createOrganization({
        actorUserId: createUuidV7(),
        correlationId: createUuidV7(),
        name: "   ",
      }),
    ).resolves.toBeNull();
    await expect(
      service.changeMembership({
        actorUserId: createUuidV7(),
        correlationId: createUuidV7(),
        nextRole: "editor",
        nextStatus: "active",
        organizationId: createUuidV7(),
        ownershipStepUpVerified: false,
        reasonCode: "free text is rejected",
        targetUserId: createUuidV7(),
      }),
    ).resolves.toEqual({ kind: "invalid" });
    expect(store.createOrganization).not.toHaveBeenCalled();
    expect(store.changeMembership).not.toHaveBeenCalled();
  });

  it("denies mutation when policy grants no membership capability", async () => {
    const store = repository();
    const service = createAccountService({
      clock: () => new Date(),
      membershipCapability: "organization:ownership",
      policy,
      repository: store,
    });
    await expect(
      service.changeMembership({
        actorUserId: createUuidV7(),
        correlationId: createUuidV7(),
        nextRole: "editor",
        nextStatus: "active",
        organizationId: createUuidV7(),
        ownershipStepUpVerified: false,
        reasonCode: "add-editor",
        targetUserId: createUuidV7(),
      }),
    ).resolves.toEqual({ kind: "forbidden" });
    expect(store.changeMembership).not.toHaveBeenCalled();
  });
});
