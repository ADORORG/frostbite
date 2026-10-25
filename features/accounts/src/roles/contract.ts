import { platformRoleSchema } from "@ador/shared/accounts";
import { uuidV7TextSchema } from "@ador/shared/identifiers";
import { z } from "zod";

// The role screen's routes (ADR-021 points 7 and 8): who holds platform roles, finding a person, giving a role and taking it away. Every one is
// for an administrator; the account that acts is always the session's own.
export const roleRoutes = {
  find: {
    method: "POST",
    operationId: "findPlatformRoleCandidates",
    path: "/api/v1/admin/roles/find",
  },
  grant: {
    method: "POST",
    operationId: "grantPlatformRole",
    path: "/api/v1/admin/roles/grant",
  },
  list: {
    method: "GET",
    operationId: "listPlatformRoleHolders",
    path: "/api/v1/admin/roles",
  },
  suspend: {
    method: "POST",
    operationId: "suspendPlatformRole",
    path: "/api/v1/admin/roles/suspend",
  },
} as const;

export const roleEmptyRequestSchema = z.strictObject({});
export const roleFindRequestSchema = z.strictObject({
  query: z.string().trim().min(1).max(200),
});
export const roleChangeRequestSchema = z.strictObject({
  role: platformRoleSchema,
  userId: uuidV7TextSchema,
});

const personSchema = z.strictObject({
  label: z.string().min(1),
  roles: z.array(
    z.strictObject({
      effective: z.boolean(),
      role: platformRoleSchema,
      status: z.enum(["active", "suspended"]),
    }),
  ),
  userId: uuidV7TextSchema,
});
export const rolePeopleResponseSchema = z.strictObject({
  people: z.array(personSchema),
});
export const roleGrantResponseSchema = z.strictObject({
  // Whether the role works yet: one that needs a sign-in method the person does not hold is recorded but does not act.
  effective: z.boolean(),
  outcome: z.enum(["granted", "reinstated", "unchanged"]),
});
export const roleSuspendResponseSchema = z.strictObject({
  outcome: z.enum(["suspended", "unchanged"]),
});

export type RoleFindRequest = z.infer<typeof roleFindRequestSchema>;
export type RoleChangeRequest = z.infer<typeof roleChangeRequestSchema>;
export type RolePeopleResponse = z.infer<typeof rolePeopleResponseSchema>;
export type RoleGrantResponse = z.infer<typeof roleGrantResponseSchema>;
export type RoleSuspendResponse = z.infer<typeof roleSuspendResponseSchema>;
