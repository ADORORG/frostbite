import {
  platformRoleSchema,
  type AuthorizationPolicy,
  type PlatformRole,
} from "@frostbite/shared/accounts";
import type { CorrelationId } from "@frostbite/shared/http";
import type { UuidV7 } from "@frostbite/shared/identifiers";

// Who may grant and suspend platform roles, and the rules that keep that safe. An administrator does it, from the role screen; every
// change is recorded with who made it, in the transaction that made it. Asking for what is already so changes nothing and writes
// nothing, so a request can be repeated.

export interface RoleChange {
  readonly actorUserId: UuidV7;
  readonly correlationId: CorrelationId;
  readonly role: string;
  readonly targetUserId: UuidV7;
}

export type GrantOutcome =
  | { readonly kind: "forbidden" }
  | { readonly kind: "invalid-role" }
  | {
      readonly kind: "granted" | "reinstated" | "unchanged";
      // Whether the role works yet: a role that needs a sign-in method the person does not hold is recorded but does not act.
      readonly effective: boolean;
    }
  | { readonly kind: "unknown-user" };

export type SuspendOutcome =
  | { readonly kind: "forbidden" }
  | { readonly kind: "invalid-role" }
  // The person is the last working administrator; suspending them would leave nobody able to manage roles.
  | { readonly kind: "last-admin" }
  | { readonly kind: "suspended" | "unchanged" }
  | { readonly kind: "unknown-user" };

export interface RoleAdministrationRepository {
  grant(
    input: Omit<RoleChange, "role"> & {
      readonly now: Date;
      readonly policyVersion: string;
      readonly role: PlatformRole;
    },
  ): Promise<Exclude<GrantOutcome, { kind: "invalid-role" }>>;
  suspend(
    input: Omit<RoleChange, "role"> & {
      readonly now: Date;
      readonly policyVersion: string;
      readonly role: PlatformRole;
    },
  ): Promise<Exclude<SuspendOutcome, { kind: "invalid-role" }>>;
}

export function createRoleAdministration(dependencies: {
  readonly clock: () => Date;
  // Only the version is used: it is written with every change, so a change can be read against the policy that was in force.
  readonly policy: Pick<AuthorizationPolicy, "version">;
  readonly repository: RoleAdministrationRepository;
}) {
  const { clock, policy, repository } = dependencies;
  return {
    async grant(change: RoleChange): Promise<GrantOutcome> {
      const role = platformRoleSchema.safeParse(change.role);
      if (!role.success) return { kind: "invalid-role" };
      return repository.grant({
        ...change,
        now: clock(),
        policyVersion: policy.version,
        role: role.data,
      });
    },
    async suspend(change: RoleChange): Promise<SuspendOutcome> {
      const role = platformRoleSchema.safeParse(change.role);
      if (!role.success) return { kind: "invalid-role" };
      return repository.suspend({
        ...change,
        now: clock(),
        policyVersion: policy.version,
        role: role.data,
      });
    },
  };
}

export type RoleAdministration = ReturnType<typeof createRoleAdministration>;
