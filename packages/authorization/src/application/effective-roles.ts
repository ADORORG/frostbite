import type { MethodKind, PlatformRole } from "@ador/shared/accounts";

// Which of an account's platform roles work. A role the policy ties to a kind of sign-in method (`requiredMethods`) takes effect only
// while the account holds every kind named; granting it without the method records it but does not let it act. One rule, used to
// decide what a person may do and who counts as an administrator.
export type RoleRequirements = Readonly<
  Partial<Record<PlatformRole, readonly MethodKind[]>>
>;

export function requiresMethods(
  role: PlatformRole,
  requirements: RoleRequirements,
): boolean {
  return (requirements[role] ?? []).length > 0;
}

export function effectiveRoles(
  assigned: readonly PlatformRole[],
  held: ReadonlySet<string>,
  requirements: RoleRequirements,
): readonly PlatformRole[] {
  return assigned.filter((role) =>
    (requirements[role] ?? []).every((kind) => held.has(kind)),
  );
}
