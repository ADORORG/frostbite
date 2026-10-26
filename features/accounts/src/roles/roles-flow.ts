import type { Requester } from "@ador/client-http";
import type { PlatformRole } from "@ador/shared/accounts";

import { failedFrom, type Failed } from "../client/outcome.ts";
import {
  roleGrantResponseSchema,
  rolePeopleResponseSchema,
  roleRoutes,
  roleSuspendResponseSchema,
  type RolePeopleResponse,
} from "./contract.ts";

export type Person = RolePeopleResponse["people"][number];

// What a role change did, in the administrator's terms: it worked, or why not, from the catalogue of outcomes.
export type ChangeOutcome =
  | {
      readonly kind: "granted" | "reinstated" | "unchanged" | "suspended";
      readonly effective: boolean;
    }
  | Failed;

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
    return failedFrom(error);
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
    return failedFrom(error);
  }
}
