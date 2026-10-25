import { ApiError, type Requester } from "@ador/client-http";
import { describe, expect, it } from "vitest";

import {
  confirmLinkCode,
  listEmailAddresses,
  removeEmailAddress,
  requestLinkCode,
} from "../src/ui/email-link-flow.ts";

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
const failing = (code: ApiError["code"], message = "the server said no") =>
  answering(new ApiError(code, 400, message));

describe("the account's addresses in the browser", () => {
  it("reads them from the server", async () => {
    const { request, sent } = answering({ addresses: ["a@b.co", "c@d.co"] });
    expect(await listEmailAddresses(request)).toEqual(["a@b.co", "c@d.co"]);
    expect(sent).toEqual([
      { body: undefined, method: "GET", path: "/api/v1/email/addresses" },
    ]);
  });
});

describe("asking for a link code in the browser", () => {
  it("posts the address and reports that a code was sent", async () => {
    const { request, sent } = answering({ sent: true });
    expect(await requestLinkCode(request, "A@b.co")).toEqual({ kind: "sent" });
    expect(sent).toEqual([
      {
        body: { email: "A@b.co" },
        method: "POST",
        path: "/api/v1/email/link/request",
      },
    ]);
  });

  it.each([
    ["forbidden", { kind: "recent-authentication" }],
    ["unauthorized", { kind: "signed-out" }],
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
    expect(
      await requestLinkCode(failing(code, "wait 30 seconds").request, "a@b.co"),
    ).toEqual(outcome);
  });

  it("does not hide a failure that is not the server's", async () => {
    const request: Requester = async () => {
      throw new TypeError("a bug");
    };
    await expect(requestLinkCode(request, "a@b.co")).rejects.toThrow("a bug");
  });
});

describe("entering a link code in the browser", () => {
  it("posts the address and the code and reports the link", async () => {
    const { request, sent } = answering({ changed: true });
    expect(await confirmLinkCode(request, "a@b.co", "123456")).toEqual({
      kind: "linked",
    });
    expect(sent).toEqual([
      {
        body: { code: "123456", email: "a@b.co" },
        method: "POST",
        path: "/api/v1/email/link/verify",
      },
    ]);
  });

  it.each([
    ["forbidden", "recent-authentication"],
    ["conflict", "taken"],
    ["unauthorized", "wrong-code"],
    ["rate_limited", "wrong-code"],
    ["network", "network"],
    ["internal_error", "network"],
    ["invalid-response", "network"],
    ["not_found", "signed-out"],
  ] as const)("reports a %s failure as %s", async (code, kind) => {
    expect(
      await confirmLinkCode(failing(code).request, "a@b.co", "123456"),
    ).toEqual({ kind });
  });
});

describe("removing an address in the browser", () => {
  it("posts the address and reports the removal", async () => {
    const { request, sent } = answering({ changed: true });
    expect(await removeEmailAddress(request, "a@b.co")).toEqual({
      kind: "removed",
    });
    expect(sent).toEqual([
      {
        body: { email: "a@b.co" },
        method: "POST",
        path: "/api/v1/email/unlink",
      },
    ]);
  });

  it.each([
    ["forbidden", "recent-authentication"],
    ["conflict", "final-method"],
    ["not_found", "missing"],
    ["unauthorized", "signed-out"],
    ["network", "network"],
    ["internal_error", "network"],
  ] as const)("reports a %s failure as %s", async (code, kind) => {
    expect(await removeEmailAddress(failing(code).request, "a@b.co")).toEqual({
      kind,
    });
  });
});
