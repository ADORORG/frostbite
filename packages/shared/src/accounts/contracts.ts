import { z } from "zod";

export const accountStatuses = ["active", "suspended"] as const;
export const accountStatusSchema = z.enum(accountStatuses);

export const organizationRoles = [
  "owner",
  "admin",
  "editor",
  "analyst",
] as const;
export const organizationRoleSchema = z.enum(organizationRoles);

// `admin` manages who holds the platform roles; `staff` operates the platform; `reviewer` decides on submissions and applications.
export const platformRoles = ["reviewer", "staff", "admin"] as const;
export const platformRoleSchema = z.enum(platformRoles);
export const organizationNameSchema = z.string().trim().min(1).max(120);
export const accountReasonCodeSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/u);

export const capabilitySchema = z
  .string()
  .min(3)
  .max(96)
  .regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/u);

// The kind of a sign-in method (`wallet`, `passkey`, `email`, ...): lower case, starting with a letter. The one definition; the sign-in
// package's method registry and the roles' requirements both use it.
export const methodKindSchema = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/u);
export type MethodKind = z.infer<typeof methodKindSchema>;

// Who may grant and suspend platform roles.
export const manageRolesCapability = "platform:manage-roles";

export const authorizationPolicySchema = z
  .object({
    organization: z.record(
      organizationRoleSchema,
      z.array(capabilitySchema).readonly(),
    ),
    platform: z.record(
      platformRoleSchema,
      z.array(capabilitySchema).readonly(),
    ),
    // The kinds of sign-in method an account must hold for a platform role to take effect. A role listed here is granted but does not
    // work while the account lacks the method. A reviewer cannot be listed: reviewer decisions are checked inside their own
    // transactions, which do not read this.
    requiredMethods: z.partialRecord(
      platformRoleSchema,
      z.array(methodKindSchema).readonly(),
    ),
    version: z.string().min(1).max(64),
  })
  .strict()
  .refine(
    ({ requiredMethods }) => (requiredMethods.reviewer ?? []).length === 0,
    {
      message: "A reviewer cannot be given required sign-in methods.",
      path: ["requiredMethods", "reviewer"],
    },
  );

export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type AuthorizationPolicy = z.infer<typeof authorizationPolicySchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type PlatformRole = z.infer<typeof platformRoleSchema>;
