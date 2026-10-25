import { ApiError, type Requester } from "@ador/client-http";
import type { PlatformRole } from "@ador/shared/accounts";

import {
  roleGrantResponseSchema,
  rolePeopleResponseSchema,
  roleRoutes,
  roleSuspendResponseSchema,
  type RolePeopleResponse,
} from "./contract.ts";

export type Person = RolePeopleResponse["people"][number];

// What a role change did, in the administrator's terms.
export type ChangeOutcome =
  | {
      readonly kind: "granted" | "reinstated" | "unchanged" | "suspended";
      readonly effective: boolean;
    }
  | {
      readonly kind:
        | "forbidden"
        | "last-admin"
        | "network"
        | "recent-authentication"
        | "signed-out"
        | "unknown-person";
    };

export async function listPeople(
  request: Requester,
): Promise<readonly Person[]> {
  return (await request(roleRoutes.list, rolePeopleResponseSchema)).people;
}

export async function findPeople(
  request: Requester,
  query: string,
): Promise<readonly Person[]> {
  return (
    await request(roleRoutes.find, rolePeopleResponseSchema, {
      body: { query },
    })
  ).people;
}

function failureOf(error: unknown): ChangeOutcome {
  if (!(error instanceof ApiError)) throw error;
  switch (error.code) {
    case "conflict":
      return { kind: "last-admin" };
    case "forbidden":
      // The server uses one code for "sign in again" and "you are not an administrator"; its message says which.
      return /recent authentication/iu.test(error.message)
        ? { kind: "recent-authentication" }
        : { kind: "forbidden" };
    case "not_found":
      return { kind: "unknown-person" };
    case "unauthorized":
      return { kind: "signed-out" };
    default:
      return { kind: "network" };
  }
}

export async function grantRole(
  request: Requester,
  userId: string,
  role: PlatformRole,
): Promise<ChangeOutcome> {
  try {
    const result = await request(roleRoutes.grant, roleGrantResponseSchema, {
      body: { role, userId },
    });
    return { effective: result.effective, kind: result.outcome };
  } catch (error) {
    return failureOf(error);
  }
}

export async function suspendRole(
  request: Requester,
  userId: string,
  role: PlatformRole,
): Promise<ChangeOutcome> {
  try {
    const result = await request(
      roleRoutes.suspend,
      roleSuspendResponseSchema,
      {
        body: { role, userId },
      },
    );
    return { effective: false, kind: result.outcome };
  } catch (error) {
    return failureOf(error);
  }
}
