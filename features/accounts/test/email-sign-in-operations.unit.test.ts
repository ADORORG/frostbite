import type { ContactCodeService } from "@frostbite/auth";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import { createEmailSignInOperations } from "../src/application/email-sign-in-operations.ts";

const context = {
  actorSession: null,
  actorUserId: null,
  correlationId: createUuidV7(),
};

function operations(overrides: Partial<ContactCodeService> = {}) {
  const service: ContactCodeService = {
    confirm: vi.fn(async () => ({ ok: false, reason: "invalid" }) as const),
    request: vi.fn(async () => ({ ok: true }) as const),
    verify: vi.fn(
      async () => ({ ok: true, sessionToken: "session-token" }) as const,
    ),
    ...overrides,
  };
  const [request, verify] = createEmailSignInOperations(() => service);
  return { request, service, verify };
}

describe("asking for an emailed code over HTTP", () => {
  it("is open to anyone, and asks the service for the email kind", async () => {
    const { request, service } = operations();
    expect(request.access).toEqual({ kind: "public" });
    expect(
      await request.execute({ email: "ada@example.com" }, context),
    ).toEqual({ ok: true, value: { sent: true } });
    expect(service.request).toHaveBeenCalledWith({
      destination: "ada@example.com",
      kind: "email",
    });
  });

  it.each([
    [
      { ok: false, reason: "invalid-destination" } as const,
      "invalid_request",
      "valid email",
    ],
    [
      { ok: false, reason: "unsupported-channel" } as const,
      "not_found",
      "not available",
    ],
    [
      { ok: false, reason: "delivery-failed" } as const,
      "conflict",
      "could not be sent",
    ],
  ])("answers %o with %s", async (result, error, message) => {
    const { request } = operations({ request: async () => result });
    const answered = await request.execute(
      { email: "ada@example.com" },
      context,
    );
    expect(answered).toMatchObject({ error, ok: false });
    expect(answered.ok ? "" : answered.message).toContain(message);
    expect(request.applicationErrors).toContain(error);
  });

  it.each([
    [1, "1 second"],
    [1001, "2 seconds"],
    [59_000, "59 seconds"],
    [60_000, "1 minute"],
    [61_000, "2 minutes"],
    [3_600_000, "60 minutes"],
  ])(
    "tells a person who must wait %i ms to wait %s, rounding up",
    async (retryAfterMs, wait) => {
      for (const reason of ["cooldown", "limit"] as const) {
        const { request } = operations({
          request: async () => ({ ok: false, reason, retryAfterMs }),
        });
        const answered = await request.execute(
          { email: "ada@example.com" },
          context,
        );
        expect(answered).toMatchObject({ error: "conflict", ok: false });
        expect(answered.ok ? "" : answered.message).toContain(`in ${wait}.`);
      }
    },
  );
});

describe("entering an emailed code over HTTP", () => {
  it("is open to anyone, and puts the session token in the cookie effect, never in the body", async () => {
    const { service, verify } = operations();
    expect(verify.access).toEqual({ kind: "public" });
    const answered = await verify.execute(
      { code: "123456", email: "ada@example.com" },
      context,
    );
    expect(answered).toEqual({
      effects: [{ kind: "replace-platform-session", token: "session-token" }],
      ok: true,
      value: { signedIn: true },
    });
    expect(JSON.stringify(answered.ok ? answered.value : null)).not.toContain(
      "session-token",
    );
    expect(service.verify).toHaveBeenCalledWith({
      code: "123456",
      destination: "ada@example.com",
      kind: "email",
    });
  });

  it("gives one answer for every failure", async () => {
    const { verify } = operations({
      verify: async () => ({ ok: false, reason: "invalid" }),
    });
    const answered = await verify.execute(
      { code: "000000", email: "ada@example.com" },
      context,
    );
    expect(answered).toMatchObject({ error: "unauthorized", ok: false });
    expect(verify.applicationErrors).toEqual(["unauthorized"]);
  });
});
