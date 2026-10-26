import { ApiError, type Requester } from "@ador/client-http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import { failed } from "../src/client/outcome.ts";
import { apiFailure } from "./support/failures.ts";
import {
  findPeople,
  grantRole,
  listPeople,
  suspendRole,
} from "../src/roles/roles-flow.ts";

const userId = createUuidV7();
const person = {
  label: "ada@example.com",
  roles: [{ effective: true, role: "staff", status: "active" }],
  userId,
};

function answering(outcome: ApiError | object) {
  const sent: { body: object | undefined; method: string; path: string }[] = [];
  const request: Requester = async (route, schema, options) => {
    sent.push({ body: options?.body, method: route.method, path: route.path });
    if (outcome instanceof ApiError) throw outcome;
    const parsed = schema.safeParse(outcome);
    if (!parsed.success) throw new Error("fixture does not fit the contract");
    return parsed.data;
  };
  return { request, sent };
}
const failing = (code: ApiError["code"], reason?: string, message?: string) =>
  answering(apiFailure(code, reason ?? null, message));

describe("reading in the browser", () => {
  it("lists the people who hold roles", async () => {
    const { request, sent } = answering({ people: [person] });
    expect(await listPeople(request)).toEqual([person]);
    expect(sent).toEqual([
      { body: undefined, method: "GET", path: "/api/v1/admin/roles" },
    ]);
  });

  it("finds people by what was typed", async () => {
    const { request, sent } = answering({ people: [person] });
    expect(await findPeople(request, "ada@example.com")).toEqual([person]);
    expect(sent).toEqual([
      {
        body: { query: "ada@example.com" },
        method: "POST",
        path: "/api/v1/admin/roles/find",
      },
    ]);
  });
});

describe("granting in the browser", () => {
  it("posts the person and the role and reports what happened and whether the role works", async () => {
    const { request, sent } = answering({
      effective: false,
      outcome: "granted",
    });
    expect(await grantRole(request, userId, "admin")).toEqual({
      effective: false,
      kind: "granted",
    });
    expect(sent).toEqual([
      {
        body: { role: "admin", userId },
        method: "POST",
        path: "/api/v1/admin/roles/grant",
      },
    ]);
  });

  it.each([
    ["forbidden", "not-an-administrator"],
    ["forbidden", "recent-authentication-required"],
    ["not_found", "no-such-account"],
    ["invalid_request", "not-a-role"],
    ["conflict", "last-administrator"],
  ] as const)(
    "reports a %s failure the server named %s as that outcome, whatever it says",
    async (code, outcome) => {
      expect(
        await grantRole(
          failing(code, outcome, "words nobody matches").request,
          userId,
          "staff",
        ),
      ).toEqual(failed(outcome));
    },
  );

  it.each([
    ["unauthorized", "signed-out"],
    ["network", "network"],
    ["internal_error", "network"],
    ["forbidden", "recent-authentication-required"],
  ] as const)("reports a %s with no reason as %s", async (code, outcome) => {
    expect(await grantRole(failing(code).request, userId, "staff")).toEqual(
      failed(outcome),
    );
  });

  it("does not hide a failure that is not the server's", async () => {
    const request: Requester = async () => {
      throw new TypeError("a bug");
    };
    await expect(grantRole(request, userId, "staff")).rejects.toThrow("a bug");
  });
});

describe("suspending in the browser", () => {
  it("posts the person and the role and reports the outcome", async () => {
    const { request, sent } = answering({ outcome: "suspended" });
    expect(await suspendRole(request, userId, "staff")).toEqual({
      effective: false,
      kind: "suspended",
    });
    expect(sent).toEqual([
      {
        body: { role: "staff", userId },
        method: "POST",
        path: "/api/v1/admin/roles/suspend",
      },
    ]);
  });

  it("reports the last administrator as such", async () => {
    expect(
      await suspendRole(
        failing("conflict", "last-administrator").request,
        userId,
        "admin",
      ),
    ).toEqual(failed("last-administrator"));
  });
});
