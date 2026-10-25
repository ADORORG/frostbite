import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import type { ActiveSession } from "../src/application/session-repository.ts";
import type { ContactChannel } from "../src/contacts/channel.ts";
import type { ContactLinkRepository } from "../src/contacts/link-repository.ts";
import { createContactLinkService } from "../src/contacts/link-service.ts";

const now = new Date("2026-10-25T12:00:00.000Z");
const window = 600_000;
const policy = {
  recentAuthenticationWindowMs: window,
  sessionAbsoluteLifetimeMs: 3_600_000,
  sessionIdleLifetimeMs: 600_000,
};
const correlationId = createUuidV7();
const userId: UuidV7 = createUuidV7();
const sessionAt = (authenticatedAt: Date): ActiveSession => ({
  absoluteExpiresAt: new Date(now.getTime() + 3_600_000),
  authenticatedAt,
  idleExpiresAt: new Date(now.getTime() + 600_000),
  sessionId: createUuidV7(),
  userId,
});
const recent = sessionAt(new Date(now.getTime() - window));
const stale = sessionAt(new Date(now.getTime() - window - 1));
const future = sessionAt(new Date(now.getTime() + 1));

const channel: ContactChannel = {
  accountName: "Email user",
  deliver: async () => undefined,
  kind: "email",
  normalize: (raw) => (raw.includes("@") ? raw.trim().toLowerCase() : null),
  policy: {
    codeLength: 6,
    lifetimeMs: 1,
    maximumAttempts: 5,
    maximumSendsPerWindow: 5,
    resendCooldownMs: 1,
    sendWindowMs: 2,
  },
};

function harness(
  options: {
    readonly confirm?: "ok" | "invalid";
    readonly link?: Awaited<
      ReturnType<ContactLinkRepository["completeLink"]>
    >["kind"];
    readonly unlink?: Awaited<
      ReturnType<ContactLinkRepository["unlink"]>
    >["kind"];
  } = {},
) {
  const repository: ContactLinkRepository = {
    completeLink: vi.fn(async () => ({ kind: options.link ?? "linked" })),
    list: vi.fn(async () => ["a@b.co"]),
    unlink: vi.fn(async () => ({ kind: options.unlink ?? "unlinked" })),
  };
  const codes = {
    confirm: vi.fn(async () =>
      options.confirm === "invalid"
        ? ({ ok: false, reason: "invalid" } as const)
        : ({ codeId: "code-1", destination: "a@b.co", ok: true } as const),
    ),
    request: vi.fn(async () => ({ ok: true }) as const),
  };
  const service = createContactLinkService({
    channels: [channel],
    clock: () => now,
    codes,
    policy,
    repository,
  });
  return { codes, repository, service };
}

describe("asking for a link code", () => {
  it("asks the code service for a code for this account", async () => {
    const { codes, service } = harness();
    expect(
      await service.request({
        destination: "a@b.co",
        kind: "email",
        session: recent,
      }),
    ).toEqual({ ok: true });
    expect(codes.request).toHaveBeenCalledWith({
      destination: "a@b.co",
      forAccount: userId,
      kind: "email",
    });
  });

  it.each([
    ["older than the window", stale],
    ["from the future", future],
  ])("sends nothing from a session %s", async (_why, session) => {
    const { codes, service } = harness();
    expect(
      await service.request({ destination: "a@b.co", kind: "email", session }),
    ).toEqual({ ok: false, reason: "recent-authentication-required" });
    expect(codes.request).not.toHaveBeenCalled();
  });
});

describe("confirming a link", () => {
  const ask = (
    service: ReturnType<typeof harness>["service"],
    session = recent,
  ) =>
    service.confirm({
      code: "123456",
      correlationId,
      destination: "A@b.co",
      kind: "email",
      session,
    });

  it("links the confirmed address, with a replacement session whose token is not stored, and a recent-window floor", async () => {
    const { repository, service } = harness();
    const result = await ask(service);
    if (!result.ok || result.sessionToken === null)
      throw new Error("expected a link");
    const [input] = vi.mocked(repository.completeLink).mock.calls[0] ?? [];
    expect(input).toMatchObject({
      codeId: "code-1",
      correlationId,
      destination: "a@b.co",
      kind: "email",
      minimumAuthenticatedAt: new Date(now.getTime() - window),
      now,
      sessionId: recent.sessionId,
      userId,
    });
    expect(input?.replacementSession.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(input?.replacementSession.tokenHash).not.toBe(result.sessionToken);
    expect(input?.replacementSession.idleExpiresAt).toEqual(
      new Date(now.getTime() + 600_000),
    );
    expect(input?.replacementSession.absoluteExpiresAt).toEqual(
      new Date(now.getTime() + 3_600_000),
    );
  });

  it("is a success with no new session when the account already held the address", async () => {
    expect(await ask(harness({ link: "already-linked" }).service)).toEqual({
      ok: true,
      sessionToken: null,
    });
  });

  it.each([
    ["taken", "taken"],
    ["code-spent", "invalid"],
    ["session-not-recent", "recent-authentication-required"],
  ] as const)("answers a %s link with %s", async (link, reason) => {
    expect(await ask(harness({ link }).service)).toEqual({ ok: false, reason });
  });

  it("changes nothing when the code is wrong", async () => {
    const { repository, service } = harness({ confirm: "invalid" });
    expect(await ask(service)).toEqual({ ok: false, reason: "invalid" });
    expect(repository.completeLink).not.toHaveBeenCalled();
  });

  it("does not even try the code from a session that is no longer recent", async () => {
    const { codes, service } = harness();
    expect(await ask(service, stale)).toEqual({
      ok: false,
      reason: "recent-authentication-required",
    });
    expect(codes.confirm).not.toHaveBeenCalled();
  });
});

describe("removing an address", () => {
  const remove = (
    service: ReturnType<typeof harness>["service"],
    session = recent,
    destination = " A@b.co",
  ) => service.unlink({ correlationId, destination, kind: "email", session });

  it("removes the normalized address and starts a replacement session", async () => {
    const { repository, service } = harness();
    const result = await remove(service);
    if (!result.ok) throw new Error("expected removal");
    expect(vi.mocked(repository.unlink).mock.calls[0]?.[0]).toMatchObject({
      destination: "a@b.co",
      kind: "email",
      userId,
    });
    expect(result.sessionToken).toHaveLength(43);
  });

  it.each([
    ["final-method", "final-method"],
    ["missing", "missing"],
    ["session-not-recent", "recent-authentication-required"],
  ] as const)("answers %s with %s", async (unlink, reason) => {
    expect(await remove(harness({ unlink }).service)).toEqual({
      ok: false,
      reason,
    });
  });

  it("says missing for something that cannot be an address, without asking the repository", async () => {
    const { repository, service } = harness();
    expect(await remove(service, recent, "nope")).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(
      await service.unlink({
        correlationId,
        destination: "a@b.co",
        kind: "phone",
        session: recent,
      }),
    ).toEqual({ ok: false, reason: "missing" });
    expect(repository.unlink).not.toHaveBeenCalled();
  });

  it("refuses from a session that is no longer recent", async () => {
    const { repository, service } = harness();
    expect(await remove(service, stale)).toEqual({
      ok: false,
      reason: "recent-authentication-required",
    });
    expect(repository.unlink).not.toHaveBeenCalled();
  });
});

describe("the service", () => {
  it("lists an account's addresses of one kind", async () => {
    const { repository, service } = harness();
    expect(await service.list("u", "email")).toEqual(["a@b.co"]);
    expect(repository.list).toHaveBeenCalledWith("u", "email");
  });

  it.each([
    [{ ...policy, recentAuthenticationWindowMs: 0 }],
    [{ ...policy, sessionIdleLifetimeMs: 0 }],
    [
      {
        ...policy,
        sessionAbsoluteLifetimeMs: policy.sessionIdleLifetimeMs - 1,
      },
    ],
  ])("refuses a policy that cannot work", (bad) => {
    expect(() =>
      createContactLinkService({
        channels: [],
        clock: () => now,
        codes: harness().codes,
        policy: bad,
        repository: harness().repository,
      }),
    ).toThrow("policy is invalid");
  });
});
