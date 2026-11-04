import { unauthenticated } from "@ador/http/outcome";
import { createUuidV7 } from "@ador/shared/identifiers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPasskeyOperations } from "../src/application/passkey-operations.ts";

const now = new Date("2026-09-10T12:00:00.000Z");
const session = {
  absoluteExpiresAt: new Date(now.getTime() + 60_000),
  authenticatedAt: now,
  idleExpiresAt: new Date(now.getTime() + 30_000),
  sessionId: createUuidV7(),
  userId: createUuidV7(),
};
const context = {
  actorSession: session,
  actorUserId: session.userId,
  correlationId: createUuidV7(),
};
const options = {
  challenge: "Y2hhbGxlbmdl",
  pubKeyCredParams: [{ alg: -7, type: "public-key" as const }],
  rp: { id: "launch.invalid", name: "Launch" },
  user: { displayName: "Player", id: "cGxheWVy", name: "Player" },
};
const credential = {
  clientExtensionResults: {},
  id: "credential",
  rawId: "credential",
  response: { attestationObject: "value", clientDataJSON: "value" },
  type: "public-key" as const,
};
const service = {
  begin: vi.fn(),
  finish: vi.fn(),
  list: vi.fn(),
  unlink: vi.fn(),
};

describe("passkey HTTP operations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only the authenticated user's credential IDs", async () => {
    service.list.mockResolvedValue(["credential"]);
    const [list] = createPasskeyOperations(() => service);
    await expect(list.execute({}, context)).resolves.toEqual({
      ok: true,
      value: { credentialIds: ["credential"] },
    });
    expect(service.list).toHaveBeenCalledWith(session.userId);
  });

  it("begins a registration using the exact authenticated session", async () => {
    const expiresAt = new Date(now.getTime() + 1_000);
    service.begin.mockResolvedValue({
      challengeId: createUuidV7(),
      expiresAt,
      options,
    });
    const [, begin] = createPasskeyOperations(() => service);
    const result = await begin.execute({}, context);
    expect(result).toMatchObject({
      ok: true,
      value: { expiresAt: expiresAt.toISOString(), options },
    });
    expect(service.begin).toHaveBeenCalledWith({
      session,
      userName: session.userId,
    });
  });

  it("rotates the cookie only after successful verification and unlink", async () => {
    service.finish.mockResolvedValue({ ok: true, sessionToken: "new-token" });
    service.unlink.mockResolvedValue({ ok: true, sessionToken: "next-token" });
    const [, , finish, unlink] = createPasskeyOperations(() => service);
    await expect(
      finish.execute({ challengeId: createUuidV7(), credential }, context),
    ).resolves.toMatchObject({
      effects: [{ kind: "replace-platform-session", token: "new-token" }],
      ok: true,
    });
    await expect(
      unlink.execute({ credentialId: "credential" }, context),
    ).resolves.toMatchObject({
      effects: [{ kind: "replace-platform-session", token: "next-token" }],
      ok: true,
    });
  });

  it.each([
    ["challenge-invalid", "conflict"],
    ["recent-authentication-required", "forbidden"],
  ] as const)(
    "maps %s without leaking account ownership",
    async (code, error) => {
      service.finish.mockResolvedValue({ code, ok: false });
      const [, , finish] = createPasskeyOperations(() => service);
      await expect(
        finish.execute({ challengeId: createUuidV7(), credential }, context),
      ).resolves.toMatchObject({ error, ok: false });
    },
  );

  it("requires recent authentication to begin and protects unlink failures", async () => {
    service.begin.mockResolvedValue(null);
    service.unlink.mockResolvedValue({ code: "final-method", ok: false });
    const [, begin, , unlink] = createPasskeyOperations(() => service);
    await expect(begin.execute({}, context)).resolves.toMatchObject({
      error: "forbidden",
      ok: false,
    });
    await expect(
      unlink.execute({ credentialId: "credential" }, context),
    ).resolves.toMatchObject({ error: "conflict", ok: false });
  });

  it("rejects every operation without an authenticated session", async () => {
    const [list, begin, finish, unlink] = createPasskeyOperations(
      () => service,
    );
    const anonymous = { ...context, actorSession: null };
    const results = await Promise.all([
      list.execute({}, anonymous),
      begin.execute({}, anonymous),
      finish.execute({ challengeId: createUuidV7(), credential }, anonymous),
      unlink.execute({ credentialId: "credential" }, anonymous),
    ]);
    // Every one gives the platform's one answer for a request with no session, so no route words it differently.
    for (const result of results) expect(result).toEqual(unauthenticated);
  });
});
