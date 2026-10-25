import { ApiError, type Requester } from "@ador/client-http";
import { describe, expect, it } from "vitest";

import {
  requestEmailCode,
  verifyEmailCode,
} from "../src/sign-in/email-sign-in-flow.ts";

function answering(outcome: ApiError | object) {
  const sent: { body: object | undefined; path: string }[] = [];
  const request: Requester = async (route, schema, options) => {
    sent.push({ body: options?.body, path: route.path });
    if (outcome instanceof ApiError) throw outcome;
    const parsed = schema.safeParse(outcome);
    if (!parsed.success) throw new Error("fixture does not fit the contract");
    return parsed.data;
  };
  return { request, sent };
}
const failing = (code: ApiError["code"], message = "the server said no") =>
  answering(new ApiError(code, 400, message));

describe("asking for a code in the browser", () => {
  it("posts the address as typed and reports that a code was sent", async () => {
    const { request, sent } = answering({ sent: true });
    expect(await requestEmailCode(request, "Ada@Example.com")).toEqual({
      kind: "sent",
    });
    expect(sent).toEqual([
      {
        body: { email: "Ada@Example.com" },
        path: "/api/v1/email/sign-in/request",
      },
    ]);
  });

  it.each([
    ["invalid_request", { kind: "invalid-email" }],
    ["not_found", { kind: "unavailable" }],
    ["conflict", { kind: "refused", message: "wait 30 seconds" }],
    [
      "rate_limited",
      {
        kind: "refused",
        message: "Too many requests. Wait a minute and try again.",
      },
    ],
    ["network", { kind: "network" }],
    ["internal_error", { kind: "network" }],
  ] as const)("reports a %s failure as %o", async (code, outcome) => {
    const { request } = failing(code, "wait 30 seconds");
    expect(await requestEmailCode(request, "ada@example.com")).toEqual(outcome);
  });

  it("does not hide a failure that is not the server's", async () => {
    const request: Requester = async () => {
      throw new TypeError("a bug");
    };
    await expect(requestEmailCode(request, "a@b.co")).rejects.toThrow("a bug");
  });
});

describe("entering a code in the browser", () => {
  it("posts the address and the code and reports the sign-in", async () => {
    const { request, sent } = answering({ signedIn: true });
    expect(await verifyEmailCode(request, "ada@example.com", "123456")).toEqual(
      { kind: "signed-in" },
    );
    expect(sent).toEqual([
      {
        body: { code: "123456", email: "ada@example.com" },
        path: "/api/v1/email/sign-in/verify",
      },
    ]);
  });

  it.each([
    ["unauthorized", "wrong-code"],
    ["invalid_request", "wrong-code"],
    ["rate_limited", "rate-limited"],
    ["network", "network"],
    ["internal_error", "network"],
    ["invalid-response", "network"],
  ] as const)("reports a %s failure as %s", async (code, kind) => {
    const { request } = failing(code);
    expect(await verifyEmailCode(request, "ada@example.com", "123456")).toEqual(
      { kind },
    );
  });

  it("does not hide a failure that is not the server's", async () => {
    const request: Requester = async () => {
      throw new TypeError("a bug");
    };
    await expect(verifyEmailCode(request, "a@b.co", "123456")).rejects.toThrow(
      "a bug",
    );
  });
});
