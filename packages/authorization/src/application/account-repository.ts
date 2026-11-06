import type {
  AccountStatus,
  OrganizationRole,
} from "@frostbite/shared/accounts";
import type { UuidV7 } from "@frostbite/shared/identifiers";

export interface AccountMutationContext {
  readonly actorUserId: UuidV7;
  readonly changedAt: Date;
  readonly correlationId: UuidV7;
  readonly policyVersion: string;
}

export type MembershipMutationResult =
  | { readonly kind: "changed" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "invalid" }
  | { readonly kind: "last-owner" }
  | { readonly kind: "not-found" };

export interface AccountRepository {
  createOrganization(
    input: AccountMutationContext & {
      readonly name: string;
      readonly organizationId: UuidV7;
    },
  ): Promise<void>;
  changeMembership(
    input: AccountMutationContext & {
      readonly allowedActorRoles: readonly OrganizationRole[];
      readonly nextRole: OrganizationRole;
      readonly nextStatus: AccountStatus;
      readonly ownershipStepUpVerified: boolean;
      readonly organizationId: UuidV7;
      readonly targetUserId: UuidV7;
      readonly reasonCode: string;
    },
  ): Promise<MembershipMutationResult>;
}
