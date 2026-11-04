import { ApiError, type Requester } from "@ador/client-http";
import { describe, expect, it } from "vitest";

import { failed } from "../src/client/outcome.ts";
import { apiFailure } from "./support/failures.ts";

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
const failing = (code: ApiError["code"], reason?: string, message?: string) =>
  answering(apiFailure(code, reason ?? null, message));

describe("the account's addresses in the browser", () => {
  it("reads them from the server: each with when it was added, and how many the account may hold", async () => {
    const view = {
      addresses: [
        { addedAt: "2026-10-01T09:30:00.000Z", address: "a@b.co" },
        { addedAt: "2026-10-02T09:30:00.000Z", address: "c@d.co" },
      ],
      maximum: 5,
    };
    const { request, sent } = answering(view);
    expect(await listEmailAddresses(request)).toEqual(view);
    expect(sent).toEqual([
      { body: undefined, method: "GET", path: "/api/v1/email/addresses" },
    ]);
  });

  it("refuses an answer in the old shape, with no dates, rather than showing a list it cannot vouch for", async () => {
    const { request } = answering({ addresses: ["a@b.co"], maximum: 5 });
    await expect(listEmailAddresses(request)).rejects.toThrow();
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

  it("reports a failure as the outcome the server named, in the catalogue's words", async () => {
    expect(
      await requestLinkCode(
        failing("conflict", "email-unavailable").request,
        "a@b.co",
      ),
    ).toEqual(failed("email-unavailable"));
  });

  it("shows the server's own words when it knows how long to wait", async () => {
    expect(
      await requestLinkCode(
        failing("conflict", "code-too-soon", "wait 30 seconds").request,
        "a@b.co",
      ),
    ).toEqual(failed("code-too-soon", "wait 30 seconds"));
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
    "email-taken",
    "code-wrong",
    "recent-authentication-required",
  ] as const)("reports %s as the server named it", async (outcome) => {
    expect(
      await confirmLinkCode(
        failing("conflict", outcome).request,
        "a@b.co",
        "123456",
      ),
    ).toEqual(failed(outcome));
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

  it.each(["last-sign-in-method", "email-missing", "signed-out"] as const)(
    "reports %s as the server named it",
    async (outcome) => {
      expect(
        await removeEmailAddress(
          failing("conflict", outcome).request,
          "a@b.co",
        ),
      ).toEqual(failed(outcome));
    },
  );
});
