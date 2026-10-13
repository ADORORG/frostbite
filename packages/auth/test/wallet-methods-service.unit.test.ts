import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import type { ActiveSession } from "../src/application/session-repository.ts";
import { sha256 } from "../src/domain/crypto.ts";
import type {
  UnlinkWalletResult,
  WalletMethodsRepository,
} from "../src/wallets/repository.ts";
import { createWalletMethodsService } from "../src/wallets/service.ts";

const now = new Date("2026-10-13T12:00:00.000Z");
const policy = {
  recentAuthenticationWindowMs: 600_000,
  releaseHoldMs: 86_400_000,
  sessionAbsoluteLifetimeMs: 86_400_000,
  sessionIdleLifetimeMs: 3_600_000,
};
const sessionAt = (authenticatedAt: Date): ActiveSession => ({
  absoluteExpiresAt: new Date(now.getTime() + 3_600_000),
  authenticatedAt,
  idleExpiresAt: new Date(now.getTime() + 3_600_000),
  sessionId: createUuidV7(),
  userId: createUuidV7(),
});

function setup(result: UnlinkWalletResult = { kind: "unlinked" }) {
  const unlink = vi.fn<WalletMethodsRepository["unlink"]>(async () => result);
  const repository: WalletMethodsRepository = { list: async () => [], unlink };
  return {
    service: createWalletMethodsService({
      clock: () => now,
      policy,
      repository,
    }),
    unlink,
  };
}
const request = (session: ActiveSession) => ({
  correlationId: createUuidV7(),
  session,
  walletId: createUuidV7(),
});

describe("removing a wallet", () => {
  it("hands the repository the hold, the recent-session floor and a replacement session whose token is only stored hashed", async () => {
    const { service, unlink } = setup();
    const session = sessionAt(new Date(now.getTime() - 60_000));
    const input = request(session);
    const outcome = await service.unlink(input);
    expect(outcome.ok).toBe(true);
    const call = unlink.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      heldUntil: new Date(now.getTime() + policy.releaseHoldMs),
      minimumAuthenticatedAt: new Date(
        now.getTime() - policy.recentAuthenticationWindowMs,
      ),
      now,
      sessionId: session.sessionId,
      userId: session.userId,
      walletId: input.walletId,
    });
    if (!outcome.ok) throw new Error("expected success");
    expect(call?.replacementSession.tokenHash).toBe(
      sha256(outcome.sessionToken),
    );
    expect(call?.replacementSession.tokenHash).not.toBe(outcome.sessionToken);
    expect(call?.replacementSession.authenticatedAt).toEqual(now);
    expect(call?.replacementSession.idleExpiresAt).toEqual(
      new Date(now.getTime() + policy.sessionIdleLifetimeMs),
    );
    expect(call?.replacementSession.absoluteExpiresAt).toEqual(
      new Date(now.getTime() + policy.sessionAbsoluteLifetimeMs),
    );
  });

  it("asks for a fresh signature, without touching anything, when the session is older than the window or dated in the future", async () => {
    const { service, unlink } = setup();
    for (const authenticatedAt of [
      new Date(now.getTime() - policy.recentAuthenticationWindowMs - 1),
      new Date(now.getTime() + 1),
    ])
      expect(await service.unlink(request(sessionAt(authenticatedAt)))).toEqual(
        {
          code: "recent-authentication-required",
          ok: false,
        },
      );
    expect(unlink).not.toHaveBeenCalled();
  });

  it("accepts a session exactly at the edge of the window, and one that has just signed in", async () => {
    const { service } = setup();
    for (const age of [policy.recentAuthenticationWindowMs, 0])
      expect(
        (
          await service.unlink(
            request(sessionAt(new Date(now.getTime() - age))),
          )
        ).ok,
      ).toBe(true);
  });

  it.each([["final-method"], ["missing"]] as const)(
    "reports %s from the repository as it is, with no session handed back",
    async (kind) => {
      const { service } = setup({ kind });
      expect(await service.unlink(request(sessionAt(now)))).toEqual({
        code: kind,
        ok: false,
      });
    },
  );

  it.each([
    ["a window of nothing", { recentAuthenticationWindowMs: 0 }],
    ["a hold of nothing", { releaseHoldMs: 0 }],
    ["an idle lifetime of nothing", { sessionIdleLifetimeMs: 0 }],
    [
      "an absolute lifetime shorter than the idle one",
      { sessionAbsoluteLifetimeMs: 1 },
    ],
  ])("refuses to start with %s", (_why, override) => {
    expect(() =>
      createWalletMethodsService({
        clock: () => now,
        policy: { ...policy, ...override },
        repository: {
          list: async () => [],
          unlink: async () => ({ kind: "unlinked" }),
        },
      }),
    ).toThrow("Wallet methods policy is invalid");
  });

  it("lists a user's wallets through the repository", async () => {
    const wallets = [
      {
        address: "tb1q",
        id: createUuidV7(),
        linkedAt: now,
        network: "signet" as const,
        walletAdapter: "x",
      },
    ];
    const service = createWalletMethodsService({
      clock: () => now,
      policy,
      repository: {
        list: async () => wallets,
        unlink: async () => ({ kind: "unlinked" }),
      },
    });
    expect(await service.list(createUuidV7())).toEqual(wallets);
  });
});
