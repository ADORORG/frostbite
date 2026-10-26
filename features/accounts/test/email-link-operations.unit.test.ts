import { accountOutcomes } from "@ador/shared/account-outcomes";
import type { ContactLinkService } from "@ador/auth";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import { createEmailLinkOperations } from "../src/application/email-link-operations.ts";

const correlationId = createUuidV7();
const actorSession = {
  absoluteExpiresAt: new Date("2026-10-26T00:00:00.000Z"),
  authenticatedAt: new Date("2026-10-25T12:00:00.000Z"),
  idleExpiresAt: new Date("2026-10-25T13:00:00.000Z"),
  sessionId: createUuidV7(),
  userId: createUuidV7(),
};
const signedIn = {
  actorSession,
  actorUserId: actorSession.userId,
  correlationId,
};
const signedOut = { actorSession: null, actorUserId: null, correlationId };

function operations(overrides: Partial<ContactLinkService> = {}) {
  const service: ContactLinkService = {
    confirm: vi.fn(
      async () => ({ ok: true, sessionToken: "token-1" }) as const,
    ),
    list: vi.fn(async () => ["a@b.co"]),
    request: vi.fn(async () => ({ ok: true }) as const),
    unlink: vi.fn(async () => ({ ok: true, sessionToken: "token-2" }) as const),
    ...overrides,
  };
  const [addresses, request, verify, unlink] = createEmailLinkOperations(
    () => service,
  );
  return { addresses, request, service, unlink, verify };
}

describe("every email-linking step", () => {
  it("needs a session, and does nothing without one", async () => {
    const { addresses, request, service, unlink, verify } = operations();
    expect(addresses.access).toEqual({ kind: "authenticated" });
    expect(request.access).toEqual({ kind: "authenticated" });
    expect(verify.access).toEqual({ kind: "authenticated" });
    expect(unlink.access).toEqual({ kind: "authenticated" });
    const answers = [
      await addresses.execute({}, signedOut),
      await request.execute({ email: "a@b.co" }, signedOut),
      await verify.execute({ code: "123456", email: "a@b.co" }, signedOut),
      await unlink.execute({ email: "a@b.co" }, signedOut),
    ];
    for (const answered of answers)
      expect(answered).toMatchObject({ error: "unauthorized", ok: false });
    expect(service.list).not.toHaveBeenCalled();
    expect(service.request).not.toHaveBeenCalled();
    expect(service.confirm).not.toHaveBeenCalled();
    expect(service.unlink).not.toHaveBeenCalled();
  });
});

describe("listing the account's addresses", () => {
  it("lists those of the session's own account", async () => {
    const { addresses, service } = operations();
    expect(await addresses.execute({}, signedIn)).toEqual({
      ok: true,
      value: { addresses: ["a@b.co"] },
    });
    expect(service.list).toHaveBeenCalledWith(actorSession.userId, "email");
  });
});

describe("asking for a link code", () => {
  it("asks for the session's own account and the email kind", async () => {
    const { request, service } = operations();
    expect(await request.execute({ email: "a@b.co" }, signedIn)).toEqual({
      ok: true,
      value: { sent: true },
    });
    expect(service.request).toHaveBeenCalledWith({
      destination: "a@b.co",
      kind: "email",
      session: actorSession,
    });
  });

  it.each([
    [
      { ok: false, reason: "recent-authentication-required" } as const,
      "forbidden",
    ],
    [{ ok: false, reason: "invalid-destination" } as const, "invalid_request"],
    [{ ok: false, reason: "unsupported-channel" } as const, "not_found"],
    [{ ok: false, reason: "delivery-failed" } as const, "conflict"],
    [
      { ok: false, reason: "cooldown", retryAfterMs: 5000 } as const,
      "conflict",
    ],
  ])("answers %o with %s", async (result, error) => {
    const { request } = operations({ request: async () => result });
    const answered = await request.execute({ email: "a@b.co" }, signedIn);
    expect(answered).toMatchObject({ error, ok: false });
    expect(request.applicationErrors).toContain(error);
  });
});

describe("entering a link code", () => {
  it("links to the session's own account and replaces the session through the cookie effect only", async () => {
    const { service, verify } = operations();
    const answered = await verify.execute(
      { code: "123456", email: "a@b.co" },
      signedIn,
    );
    expect(answered).toEqual({
      effects: [{ kind: "replace-platform-session", token: "token-1" }],
      ok: true,
      value: { changed: true },
    });
    expect(JSON.stringify(answered.ok ? answered.value : null)).not.toContain(
      "token-1",
    );
    expect(service.confirm).toHaveBeenCalledWith({
      code: "123456",
      correlationId,
      destination: "a@b.co",
      kind: "email",
      session: actorSession,
    });
  });

  it("is a success that replaces no session when the account already held the address", async () => {
    const { verify } = operations({
      confirm: async () => ({ ok: true, sessionToken: null }),
    });
    expect(
      await verify.execute({ code: "123456", email: "a@b.co" }, signedIn),
    ).toEqual({ effects: [], ok: true, value: { changed: true } });
  });

  it.each([
    ["taken", "conflict", "email-taken"],
    [
      "recent-authentication-required",
      "forbidden",
      "recent-authentication-required",
    ],
    ["invalid", "unauthorized", "code-wrong"],
  ] as const)(
    "answers %s with %s, naming the outcome",
    async (reason, error, outcome) => {
      const { verify } = operations({
        confirm: async () => ({ ok: false, reason }),
      });
      const answered = await verify.execute(
        { code: "123456", email: "a@b.co" },
        signedIn,
      );
      expect(answered).toMatchObject({
        error,
        message: accountOutcomes[outcome].message,
        ok: false,
        reason: outcome,
      });
      expect(verify.applicationErrors).toContain(error);
    },
  );
});

describe("removing an address", () => {
  it("removes it from the session's own account and replaces the session", async () => {
    const { service, unlink } = operations();
    expect(await unlink.execute({ email: "a@b.co" }, signedIn)).toEqual({
      effects: [{ kind: "replace-platform-session", token: "token-2" }],
      ok: true,
      value: { changed: true },
    });
    expect(service.unlink).toHaveBeenCalledWith({
      correlationId,
      destination: "a@b.co",
      kind: "email",
      session: actorSession,
    });
  });

  it.each([
    ["final-method", "conflict", "last-sign-in-method"],
    ["missing", "not_found", "email-missing"],
    [
      "recent-authentication-required",
      "forbidden",
      "recent-authentication-required",
    ],
  ] as const)(
    "answers %s with %s, naming the outcome",
    async (reason, error, outcome) => {
      const { unlink } = operations({
        unlink: async () => ({ ok: false, reason }),
      });
      const answered = await unlink.execute({ email: "a@b.co" }, signedIn);
      expect(answered).toMatchObject({
        error,
        message: accountOutcomes[outcome].message,
        ok: false,
        reason: outcome,
      });
      expect(unlink.applicationErrors).toContain(error);
    },
  );
});
