import type {
  DirectoryEntry,
  RoleAdministration,
  RoleDirectory,
} from "@ador/authorization";
import type { HttpOperation } from "@ador/http";
import { failure, unauthenticated } from "@ador/http/outcome";
import { manageRolesCapability } from "@ador/shared/accounts";
import { uuidV7Schema } from "@ador/shared/identifiers";

import {
  roleChangeRequestSchema,
  roleEmptyRequestSchema,
  roleFindRequestSchema,
  roleGrantResponseSchema,
  rolePeopleResponseSchema,
  roleRoutes,
  roleSuspendResponseSchema,
  type RoleChangeRequest,
  type RoleFindRequest,
  type RoleGrantResponse,
  type RolePeopleResponse,
  type RoleSuspendResponse,
} from "./contract.ts";

// What the role operations need, as one value so they are built from it and tested with stand-ins.
export interface RoleServices {
  readonly administration: Pick<RoleAdministration, "grant" | "suspend">;
  readonly directory: Pick<RoleDirectory, "find" | "holders">;
  // How recently the session must have signed in to change who holds a role.
  readonly recentAuthenticationWindowMs: number;
}

// The directory's entries as the response carries them (plain values, the roles copied).
export const plainPeople = (entries: readonly DirectoryEntry[]) =>
  entries.map(({ label, roles, userId }) => ({
    label,
    roles: roles.map((role) => ({ ...role })),
    userId,
  }));

const access = { capability: manageRolesCapability, kind: "platform" } as const;
const recentAuthenticationRequired = failure(
  "forbidden",
  "Recent authentication is required. Sign in again, then retry.",
);
const notAnAdministrator = failure(
  "forbidden",
  "Only an administrator whose role is working can change roles.",
);

// The role screen's operations. Who may use them is the platform's capability check; the service checks it again inside the change's
// transaction, because a role can be suspended between the two.
export function createRoleOperations(getServices: () => RoleServices) {
  const list: HttpOperation<Record<string, never>, RolePeopleResponse> = {
    access,
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorSession === null) return unauthenticated;
      return {
        ok: true,
        value: { people: plainPeople(await getServices().directory.holders()) },
      };
    },
    idempotency: "none",
    input: "none",
    inputSchema: roleEmptyRequestSchema,
    outputSchema: rolePeopleResponseSchema,
    ...roleRoutes.list,
  };
  const find: HttpOperation<RoleFindRequest, RolePeopleResponse> = {
    access,
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorSession === null) return unauthenticated;
      return {
        ok: true,
        value: {
          people: plainPeople(await getServices().directory.find(input.query)),
        },
      };
    },
    idempotency: "none",
    input: "json",
    inputSchema: roleFindRequestSchema,
    outputSchema: rolePeopleResponseSchema,
    ...roleRoutes.find,
  };
  function recent(
    session: { readonly authenticatedAt: Date },
    window: number,
  ): boolean {
    const age = Date.now() - session.authenticatedAt.getTime();
    return age >= 0 && age <= window;
  }
  const grant: HttpOperation<RoleChangeRequest, RoleGrantResponse> = {
    access,
    applicationErrors: [
      "forbidden",
      "invalid_request",
      "not_found",
      "unauthorized",
    ],
    execute: async (input, context) => {
      const session = context.actorSession;
      if (session === null) return unauthenticated;
      const services = getServices();
      if (!recent(session, services.recentAuthenticationWindowMs))
        return recentAuthenticationRequired;
      const result = await services.administration.grant({
        actorUserId: session.userId,
        correlationId: context.correlationId,
        role: input.role,
        targetUserId: uuidV7Schema.parse(input.userId),
      });
      switch (result.kind) {
        case "forbidden":
          return notAnAdministrator;
        case "invalid-role":
          return failure("invalid_request", "That is not a platform role.");
        case "unknown-user":
          return failure("not_found", "No such account.");
        default:
          return {
            ok: true,
            value: { effective: result.effective, outcome: result.kind },
          };
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: roleChangeRequestSchema,
    outputSchema: roleGrantResponseSchema,
    ...roleRoutes.grant,
  };
  const suspend: HttpOperation<RoleChangeRequest, RoleSuspendResponse> = {
    access,
    applicationErrors: [
      "conflict",
      "forbidden",
      "invalid_request",
      "not_found",
      "unauthorized",
    ],
    execute: async (input, context) => {
      const session = context.actorSession;
      if (session === null) return unauthenticated;
      const services = getServices();
      if (!recent(session, services.recentAuthenticationWindowMs))
        return recentAuthenticationRequired;
      const result = await services.administration.suspend({
        actorUserId: session.userId,
        correlationId: context.correlationId,
        role: input.role,
        targetUserId: uuidV7Schema.parse(input.userId),
      });
      switch (result.kind) {
        case "forbidden":
          return notAnAdministrator;
        case "invalid-role":
          return failure("invalid_request", "That is not a platform role.");
        case "unknown-user":
          return failure("not_found", "No such account.");
        case "last-admin":
          return failure(
            "conflict",
            "This is the last working administrator. Make another administrator first.",
          );
        default:
          return { ok: true, value: { outcome: result.kind } };
      }
    },
    idempotency: "none",
    input: "json",
    inputSchema: roleChangeRequestSchema,
    outputSchema: roleSuspendResponseSchema,
    ...roleRoutes.suspend,
  };
  return [list, find, grant, suspend] as const;
}
