import { createWalletMethodsOperations } from "../src/application/wallet-methods-operations.ts";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { accountOutcomes } from "@frostbite/shared/account-outcomes";
import { describe, expect, it } from "vitest";

import {
  address,
  anonymous,
  challengeId,
  origin,
  services,
  session,
  signedIn,
  walletRequest,
} from "./support/wallet-operations.ts";

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

  it.each([
    [
      "wallet-on-another-account",
      accountOutcomes["wallet-on-another-account"].message,
    ],
    ["wallet-held", accountOutcomes["wallet-held"].message],
    ["wallet-not-on-account", accountOutcomes["wallet-not-on-account"].message],
  ] as const)(
    "tells whoever just proved they hold a wallet's key why it cannot be used (%s), as a conflict",
    async (code, message) => {
      const s = services();
      const operations = createWalletMethodsOperations(() => s.services);
      s.verify.mockResolvedValueOnce({ code, ok: false } as never);
      expect(
        await operations[1].execute(
          { challengeId, signature: "s" } as never,
          signedIn(),
        ),
      ).toMatchObject({ error: "conflict", message, ok: false });
      // Neither names the other account.
      expect(message).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}/iu);
    },
  );

  it("answers a wallet that cannot be used for any other reason with the generic conflict, and a bad challenge as not verified", async () => {
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

  it("asks for a fresh signature when the session is stale, and says the last way in and a wallet that is not there apart", async () => {
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
    expect(answers[0]).toMatchObject({
      error: "forbidden",
      ok: false,
      reason: "recent-authentication-required",
    });
    expect(answers[1]).toMatchObject({
      error: "conflict",
      ok: false,
      reason: "last-sign-in-method",
    });
    expect(answers[2]).toMatchObject({
      error: "not_found",
      ok: false,
      reason: "wallet-missing",
    });
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
