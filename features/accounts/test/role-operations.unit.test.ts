import type { DirectoryEntry } from "@frostbite/authorization";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRoleOperations,
  type RoleServices,
} from "../src/roles/operations.ts";

const now = new Date("2026-10-25T12:00:00.000Z");
const window = 600_000;
const correlationId = createUuidV7();
const target = createUuidV7();
const sessionAt = (authenticatedAt: Date) => ({
  absoluteExpiresAt: new Date(now.getTime() + 3_600_000),
  authenticatedAt,
  idleExpiresAt: new Date(now.getTime() + 600_000),
  sessionId: createUuidV7(),
  userId: createUuidV7(),
});
const recentSession = sessionAt(new Date(now.getTime() - window));
const as = (session: ReturnType<typeof sessionAt> | null) => ({
  actorSession: session,
  actorUserId: session?.userId ?? null,
  correlationId,
});
const entry: DirectoryEntry = {
  label: "ada@example.com",
  roles: [{ effective: true, role: "staff", status: "active" }],
  userId: target,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

function operations(overrides: Partial<RoleServices["administration"]> = {}) {
  const services: RoleServices = {
    administration: {
      grant: vi.fn(async () => ({ effective: true, kind: "granted" }) as const),
      suspend: vi.fn(async () => ({ kind: "suspended" }) as const),
      ...overrides,
    },
    directory: {
      find: vi.fn(async () => [entry]),
      holders: vi.fn(async () => [entry]),
    },
    recentAuthenticationWindowMs: window,
  };
  const [list, find, grant, suspend] = createRoleOperations(() => services);
  return { find, grant, list, services, suspend };
}

describe("every role operation", () => {
  it("is for the capability that manages roles, needs a session, and does nothing without one", async () => {
    const { find, grant, list, services, suspend } = operations();
    for (const operation of [list, find, grant, suspend])
      expect(operation.access).toEqual({
        capability: "platform:manage-roles",
        kind: "platform",
      });
    const answers = [
      await list.execute({}, as(null)),
      await find.execute({ query: "x" }, as(null)),
      await grant.execute({ role: "staff", userId: target }, as(null)),
      await suspend.execute({ role: "staff", userId: target }, as(null)),
    ];
    for (const answered of answers)
      expect(answered).toMatchObject({ error: "unauthorized", ok: false });
    expect(services.directory.holders).not.toHaveBeenCalled();
    expect(services.directory.find).not.toHaveBeenCalled();
    expect(services.administration.grant).not.toHaveBeenCalled();
    expect(services.administration.suspend).not.toHaveBeenCalled();
  });
});

describe("reading", () => {
  it("lists who holds roles, and finds people by what was typed", async () => {
    const { find, list, services } = operations();
    expect(await list.execute({}, as(recentSession))).toEqual({
      ok: true,
      value: { people: [entry] },
    });
    expect(
      await find.execute({ query: "ada@example.com" }, as(recentSession)),
    ).toEqual({ ok: true, value: { people: [entry] } });
    expect(services.directory.find).toHaveBeenCalledWith("ada@example.com");
  });

  it("needs no recent sign-in to read", async () => {
    const stale = as(sessionAt(new Date(now.getTime() - window - 1)));
    const { list } = operations();
    expect((await list.execute({}, stale)).ok).toBe(true);
  });
});

describe("granting and suspending", () => {
  it("acts as the session's own account, never one the request names, and passes the correlation id", async () => {
    const { grant, services, suspend } = operations();
    expect(
      await grant.execute({ role: "staff", userId: target }, as(recentSession)),
    ).toEqual({
      ok: true,
      value: { effective: true, outcome: "granted" },
    });
    expect(services.administration.grant).toHaveBeenCalledWith({
      actorUserId: recentSession.userId,
      correlationId,
      role: "staff",
      targetUserId: target,
    });
    expect(
      await suspend.execute(
        { role: "admin", userId: target },
        as(recentSession),
      ),
    ).toEqual({
      ok: true,
      value: { outcome: "suspended" },
    });
    expect(services.administration.suspend).toHaveBeenCalledWith({
      actorUserId: recentSession.userId,
      correlationId,
      role: "admin",
      targetUserId: target,
    });
  });

  it("says a role that was granted but cannot work yet, and a repeat that changed nothing", async () => {
    const { grant } = operations({
      grant: async () => ({ effective: false, kind: "reinstated" }),
    });
    expect(
      await grant.execute({ role: "admin", userId: target }, as(recentSession)),
    ).toEqual({
      ok: true,
      value: { effective: false, outcome: "reinstated" },
    });
    const unchanged = operations({
      suspend: async () => ({ kind: "unchanged" }),
    });
    expect(
      await unchanged.suspend.execute(
        { role: "staff", userId: target },
        as(recentSession),
      ),
    ).toEqual({
      ok: true,
      value: { outcome: "unchanged" },
    });
  });

  it.each([
    ["older than the window", sessionAt(new Date(now.getTime() - window - 1))],
    ["from the future", sessionAt(new Date(now.getTime() + 1))],
  ])(
    "refuses from a session %s, before touching anything",
    async (_why, session) => {
      const { grant, services, suspend } = operations();
      for (const answered of [
        await grant.execute({ role: "staff", userId: target }, as(session)),
        await suspend.execute({ role: "staff", userId: target }, as(session)),
      ])
        expect(answered).toMatchObject({ error: "forbidden", ok: false });
      expect(services.administration.grant).not.toHaveBeenCalled();
      expect(services.administration.suspend).not.toHaveBeenCalled();
    },
  );

  it("accepts a session signed in exactly one window ago", async () => {
    const { grant } = operations();
    expect(
      (
        await grant.execute(
          { role: "staff", userId: target },
          as(recentSession),
        )
      ).ok,
    ).toBe(true);
  });

  it.each([
    [{ kind: "forbidden" } as const, "forbidden", "administrator"],
    [{ kind: "invalid-role" } as const, "invalid_request", "platform role"],
    [{ kind: "unknown-user" } as const, "not_found", "No such account"],
  ])("answers a grant of %o with %s", async (result, error, text) => {
    const { grant } = operations({ grant: async () => result });
    const answered = await grant.execute(
      { role: "staff", userId: target },
      as(recentSession),
    );
    expect(answered).toMatchObject({ error, ok: false });
    expect(answered.ok ? "" : answered.message).toContain(text);
    expect(grant.applicationErrors).toContain(error);
  });

  it.each([
    [{ kind: "forbidden" } as const, "forbidden", "administrator"],
    [{ kind: "invalid-role" } as const, "invalid_request", "platform role"],
    [{ kind: "unknown-user" } as const, "not_found", "No such account"],
    [{ kind: "last-admin" } as const, "conflict", "last working administrator"],
  ])("answers a suspension of %o with %s", async (result, error, text) => {
    const { suspend } = operations({ suspend: async () => result });
    const answered = await suspend.execute(
      { role: "admin", userId: target },
      as(recentSession),
    );
    expect(answered).toMatchObject({ error, ok: false });
    expect(answered.ok ? "" : answered.message).toContain(text);
    expect(suspend.applicationErrors).toContain(error);
  });
});
