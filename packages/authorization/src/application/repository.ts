import type {
  AccountStatus,
  MethodKind,
  OrganizationRole,
  PlatformRole,
} from "@ador/shared/accounts";
import type { UuidV7 } from "@ador/shared/identifiers";

export interface OrganizationAccessRecord {
  readonly membershipStatus: AccountStatus;
  readonly organizationStatus: AccountStatus;
  readonly role: OrganizationRole;
}

export interface AuthorizationRepository {
  findOrganizationAccess(
    userId: UuidV7,
    organizationId: UuidV7,
  ): Promise<OrganizationAccessRecord | null>;
  // The roles the account was given and that are active, whether or not they work yet (see `effectiveRoles`).
  findPlatformRoles(userId: UuidV7): Promise<readonly PlatformRole[]>;
  // The kinds of sign-in method the account holds now.
  findHeldMethodKinds(userId: UuidV7): Promise<ReadonlySet<MethodKind>>;
}
