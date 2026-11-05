import { ApiError, type Requester } from "@frostbite/client-http";
import { describe, expect, it } from "vitest";

import { failed } from "../src/client/outcome.ts";
import { apiFailure } from "./support/failures.ts";

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
const failing = (code: ApiError["code"], reason?: string, message?: string) =>
  answering(apiFailure(code, reason ?? null, message));

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

  it.each(["invalid-email", "email-unavailable", "code-not-sent"] as const)(
    "reports %s as the server named it",
    async (outcome) => {
      const { request } = failing("conflict", outcome);
      expect(await requestEmailCode(request, "ada@example.com")).toEqual(
        failed(outcome),
      );
    },
  );

  it("shows the server's own words when it knows how long to wait, and the catalogue's for a rate limit", async () => {
    expect(
      await requestEmailCode(
        failing("conflict", "code-too-soon", "wait 30 seconds").request,
        "ada@example.com",
      ),
    ).toEqual(failed("code-too-soon", "wait 30 seconds"));
    expect(
      await requestEmailCode(
        failing("rate_limited").request,
        "ada@example.com",
      ),
    ).toEqual(failed("rate-limited"));
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
    ["unauthorized", "code-wrong"],
    ["invalid_request", "code-wrong"],
    ["conflict", "code-wrong"],
    ["rate_limited", "rate-limited"],
    ["network", "network"],
    ["internal_error", "network"],
    ["invalid-response", "network"],
  ] as const)(
    "reports a %s with no reason as %s: anything not named is a code that was not right",
    async (code, outcome) => {
      const { request } = failing(code);
      expect(
        await verifyEmailCode(request, "ada@example.com", "123456"),
      ).toEqual(failed(outcome));
    },
  );

  it("reports the outcome the server named over the one it would assume", async () => {
    expect(
      await verifyEmailCode(
        failing("conflict", "code-not-sent").request,
        "ada@example.com",
        "1",
      ),
    ).toEqual(failed("code-not-sent"));
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
