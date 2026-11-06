import {
  authorizationPolicySchema,
  accountReasonCodeSchema,
  capabilitySchema,
  organizationNameSchema,
  organizationRoles,
  type AccountStatus,
  type AuthorizationPolicy,
  type Capability,
  type OrganizationRole,
} from "@frostbite/shared/accounts";
import { createUuidV7, type UuidV7 } from "@frostbite/shared/identifiers";

import type {
  AccountRepository,
  MembershipMutationResult,
} from "./account-repository.ts";

export function createAccountService(dependencies: {
  readonly clock: () => Date;
  readonly membershipCapability: Capability;
  readonly policy: AuthorizationPolicy;
  readonly repository: AccountRepository;
}) {
  const policy = authorizationPolicySchema.parse(dependencies.policy);
  const membershipCapability = capabilitySchema.parse(
    dependencies.membershipCapability,
  );
  const allowedActorRoles = organizationRoles.filter((role) =>
    policy.organization[role].includes(membershipCapability),
  );

  return {
    async createOrganization(input: {
      readonly actorUserId: UuidV7;
      readonly correlationId: UuidV7;
      readonly name: string;
    }): Promise<{ readonly organizationId: UuidV7 } | null> {
      const name = organizationNameSchema.safeParse(input.name);
      if (!name.success) return null;
      const organizationId = createUuidV7();
      await dependencies.repository.createOrganization({
        actorUserId: input.actorUserId,
        changedAt: dependencies.clock(),
        correlationId: input.correlationId,
        name: name.data,
        organizationId,
        policyVersion: policy.version,
      });
      return { organizationId };
    },

    changeMembership(input: {
      readonly actorUserId: UuidV7;
      readonly correlationId: UuidV7;
      readonly nextRole: OrganizationRole;
      readonly nextStatus: AccountStatus;
      readonly ownershipStepUpVerified: boolean;
      readonly organizationId: UuidV7;
      readonly targetUserId: UuidV7;
      readonly reasonCode: string;
    }): Promise<MembershipMutationResult> {
      const reasonCode = accountReasonCodeSchema.safeParse(input.reasonCode);
      if (!reasonCode.success) return Promise.resolve({ kind: "invalid" });
      if (allowedActorRoles.length === 0)
        return Promise.resolve({ kind: "forbidden" });
      return dependencies.repository.changeMembership({
        ...input,
        allowedActorRoles,
        changedAt: dependencies.clock(),
        policyVersion: policy.version,
        reasonCode: reasonCode.data,
      });
    },
  };
}
