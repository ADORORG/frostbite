import type { WalletAuthServices } from "../src/application/wallet-services.ts";
import { createWalletMethodsOperations } from "../src/application/wallet-methods-operations.ts";
import { createWalletSignInOperations } from "../src/application/wallet-sign-in-operations.ts";
import type { HttpOperationContext } from "@ador/http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

const origin = "https://launch.example";
const address = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";
const walletRequest = {
  address,
  network: "signet",
  walletAdapter: "xverse",
} as const;
const challengeId = createUuidV7();

function session(ageMs = 0) {
  const now = Date.now();
  return {
    absoluteExpiresAt: new Date(now + 3_600_000),
    authenticatedAt: new Date(now - ageMs),
    idleExpiresAt: new Date(now + 3_600_000),
    sessionId: createUuidV7(),
    userId: createUuidV7(),
  };
}
const signedIn = (actorSession = session()): HttpOperationContext => ({
  actorSession,
  actorUserId: actorSession.userId,
  correlationId: createUuidV7(),
});
const anonymous: HttpOperationContext = {
  actorSession: null,
  actorUserId: null,
  correlationId: createUuidV7(),
};

function services(overrides: Partial<WalletAuthServices> = {}) {
  const issue = vi.fn(async () => ({
    challengeId,
    expiresAt: new Date("2026-10-13T12:05:00.000Z"),
    message: "the message to sign",
    signatureScheme: "bip322-simple" as const,
  }));
  const verify = vi.fn(async () => ({
    ok: true as const,
    sessionToken: "fresh-token",
    userId: createUuidV7(),
  }));
  const unlink = vi.fn(async () => ({
    ok: true as const,
    sessionToken: "rotated-token",
  }));
  const list = vi.fn(async () => []);
  const revokeSession = vi.fn(async () => true);
  const value = {
    auth: { issue, verify },
    methods: { list, unlink },
    origin,
    passkeys: { list: vi.fn(async () => ["credential-1"]) },
    recentAuthenticationWindowMs: 600_000,
    sessions: { revokeSession },
    ...overrides,
  } as unknown as WalletAuthServices;
  return { issue, list, revokeSession, services: value, unlink, verify };
}

describe("signing in with a wallet", () => {
  it("issues a sign-in challenge for the platform's own origin and page, whatever the request says, with no account named", async () => {
    const s = services();
    const [begin] = createWalletSignInOperations(() => s.services);
    const result = await begin.execute(walletRequest, anonymous);
    expect(result).toEqual({
      ok: true,
      value: {
        challengeId,
        expiresAt: "2026-10-13T12:05:00.000Z",
        message: "the message to sign",
        signatureScheme: "bip322-simple",
      },
    });
    expect(s.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sign-in",
        address,
        expectedUserId: undefined,
        network: "signet",
        origin,
        uri: `${origin}/auth/wallet`,
        walletAdapter: "xverse",
      }),
    );
    expect(begin.access).toEqual({ kind: "public" });
  });

  it("refuses a request the wallet service will not issue a challenge for", async () => {
    const s = services();
    s.issue.mockResolvedValueOnce(null as never);
    const [begin] = createWalletSignInOperations(() => s.services);
    expect(await begin.execute(walletRequest, anonymous)).toMatchObject({
      error: "invalid_request",
      ok: false,
    });
  });

  it("starts the session, which reaches the browser only as a cookie, and verifies only a sign-in challenge", async () => {
    const s = services();
    const [, verify] = createWalletSignInOperations(() => s.services);
    const result = await verify.execute(
      { challengeId, signature: "sig" },
      anonymous,
    );
    expect(result).toEqual({
      effects: [{ kind: "replace-platform-session", token: "fresh-token" }],
      ok: true,
      value: { signedIn: true },
    });
    expect(JSON.stringify((result as { value: object }).value)).not.toContain(
      "fresh-token",
    );
    expect(s.verify).toHaveBeenCalledWith({
      challengeId,
      expectedAction: "sign-in",
      signature: "sig",
    });
    expect(verify.access).toEqual({ kind: "public" });
  });

  it("tells every failure the same way except a conflict, which is its own, and says nothing about whose a wallet is", async () => {
    const answers = new Map<string, string>();
    for (const code of [
      "challenge-expired",
      "challenge-invalid",
      "challenge-replayed",
      "signature-invalid",
      "identity-conflict",
    ] as const) {
      const s = services();
      s.verify.mockResolvedValueOnce({ code, ok: false } as never);
      const [, verify] = createWalletSignInOperations(() => s.services);
      const result = await verify.execute(
        { challengeId, signature: "sig" },
        anonymous,
      );
      expect(result.ok).toBe(false);
      answers.set(code, JSON.stringify(result));
    }
    const distinct = new Set(answers.values());
    expect(distinct.size).toBe(2);
    expect(JSON.parse(answers.get("identity-conflict") ?? "{}")).toMatchObject({
      error: "conflict",
    });
    expect(JSON.parse(answers.get("signature-invalid") ?? "{}")).toMatchObject({
      error: "unauthorized",
    });
  });
});

describe("signing out", () => {
  it("is refused without a session, and touches nothing", async () => {
    const s = services();
    const [, , signOut] = createWalletSignInOperations(() => s.services);
    expect(await signOut.execute({}, anonymous)).toMatchObject({
      error: "unauthorized",
      ok: false,
    });
    expect(s.revokeSession).not.toHaveBeenCalled();
  });

  it("ends this session only, and clears the cookie even when the session was already gone", async () => {
    const s = services();
    const [, , signOut] = createWalletSignInOperations(() => s.services);
    const mine = session();
    expect(await signOut.execute({}, signedIn(mine))).toEqual({
      effects: [{ kind: "clear-platform-session" }],
      ok: true,
      value: { changed: true },
    });
    expect(s.revokeSession).toHaveBeenCalledWith(mine);
    s.revokeSession.mockResolvedValueOnce(false);
    expect(await signOut.execute({}, signedIn(mine))).toMatchObject({
      effects: [{ kind: "clear-platform-session" }],
      ok: true,
    });
  });
});

describe("linking another wallet and signing again", () => {
  const [beginLink, verifyLink, beginStepUp, verifyStepUp, unlink, methods] =
    createWalletMethodsOperations(() => services().services);

  it("needs a session for every one of them", async () => {
    const s = services();
    const operations = createWalletMethodsOperations(() => s.services);
    for (const operation of operations)
      expect(operation.access).toEqual({ kind: "authenticated" });
    const requests = [
      walletRequest,
      { challengeId, signature: "s" },
      walletRequest,
      { challengeId, signature: "s" },
      { walletId: createUuidV7() },
      {},
    ];
    for (const [at, operation] of operations.entries())
      expect(
        await operation.execute(requests[at] as never, anonymous),
      ).toMatchObject({ error: "unauthorized", ok: false });
    expect(s.issue).not.toHaveBeenCalled();
    expect(s.verify).not.toHaveBeenCalled();
    expect(s.unlink).not.toHaveBeenCalled();
    void beginLink;
    void verifyLink;
    void beginStepUp;
    void verifyStepUp;
    void unlink;
    void methods;
  });

  it.each([
    ["link", 0, 1, "link-wallet"],
    ["step-up", 2, 3, "step-up"],
  ] as const)(
    "a %s challenge names the session's own account, and is verified only as that action for that account",
    async (_name, beginAt, verifyAt, action) => {
      const s = services();
      const operations = createWalletMethodsOperations(() => s.services);
      const mine = session();
      await operations[beginAt].execute(walletRequest as never, signedIn(mine));
      expect(s.issue).toHaveBeenCalledWith(
        expect.objectContaining({
          action,
          expectedUserId: mine.userId,
          origin,
        }),
      );
      const verified = await operations[verifyAt].execute(
        { challengeId, signature: "sig" } as never,
        signedIn(mine),
      );
      expect(verified).toEqual({
        effects: [{ kind: "replace-platform-session", token: "fresh-token" }],
        ok: true,
        value: { changed: true },
      });
      expect(s.verify).toHaveBeenCalledWith({
        challengeId,
        expectedAction: action,
        expectedUserId: mine.userId,
        signature: "sig",
      });
    },
  );

  it("answers a wallet that belongs elsewhere, or is held, with the generic conflict, and a bad challenge as not verified", async () => {
    const s = services();
    const operations = createWalletMethodsOperations(() => s.services);
    s.verify.mockResolvedValueOnce({
      code: "identity-conflict",
      ok: false,
    } as never);
    expect(
      await operations[1].execute(
        { challengeId, signature: "s" } as never,
        signedIn(),
      ),
    ).toMatchObject({
      error: "conflict",
      message: "This wallet cannot be used for that.",
    });
    s.verify.mockResolvedValueOnce({
      code: "challenge-invalid",
      ok: false,
    } as never);
    expect(
      await operations[3].execute(
        { challengeId, signature: "s" } as never,
        signedIn(),
      ),
    ).toMatchObject({ error: "unauthorized" });
  });
});

describe("removing a wallet and listing the account's ways in", () => {
  it("removes it for the session's own account, rotating the session", async () => {
    const s = services();
    const operations = createWalletMethodsOperations(() => s.services);
    const mine = session();
    const walletId = createUuidV7();
    const context = signedIn(mine);
    expect(await operations[4].execute({ walletId } as never, context)).toEqual(
      {
        effects: [{ kind: "replace-platform-session", token: "rotated-token" }],
        ok: true,
        value: { changed: true },
      },
    );
    expect(s.unlink).toHaveBeenCalledWith({
      correlationId: context.correlationId,
      session: mine,
      walletId,
    });
  });

  it("asks for a fresh signature when the session is stale, and gives one answer for the last way in and for a wallet that is not there", async () => {
    const answers: unknown[] = [];
    for (const code of [
      "recent-authentication-required",
      "final-method",
      "missing",
    ] as const) {
      const s = services();
      s.unlink.mockResolvedValueOnce({ code, ok: false } as never);
      const operations = createWalletMethodsOperations(() => s.services);
      answers.push(
        await operations[4].execute(
          { walletId: createUuidV7() } as never,
          signedIn(),
        ),
      );
    }
    expect(answers[0]).toMatchObject({ error: "forbidden", ok: false });
    expect(answers[1]).toMatchObject({ error: "conflict", ok: false });
    expect(answers[2]).toEqual(answers[1]);
  });

  it("lists wallets and passkeys, and says whether the session is recent enough to remove one", async () => {
    const s = services();
    const wallet = {
      address,
      id: createUuidV7(),
      linkedAt: new Date("2026-10-01T00:00:00.000Z"),
      network: "signet" as const,
      walletAdapter: "xverse",
    };
    s.list.mockResolvedValue([wallet] as never);
    const operations = createWalletMethodsOperations(() => s.services);
    const result = await operations[5].execute({}, signedIn(session(1_000)));
    expect(result).toEqual({
      ok: true,
      value: {
        passkeys: [{ credentialId: "credential-1" }],
        recentAuthentication: true,
        wallets: [
          {
            address,
            id: wallet.id,
            linkedAt: "2026-10-01T00:00:00.000Z",
            network: "signet",
            walletAdapter: "xverse",
          },
        ],
      },
    });
    for (const age of [600_001, -60_000])
      expect(
        await operations[5].execute({}, signedIn(session(age))),
      ).toMatchObject({
        value: { recentAuthentication: false },
      });
  });
});
