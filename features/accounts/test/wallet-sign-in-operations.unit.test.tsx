import { createWalletSignInOperations } from "../src/application/wallet-sign-in-operations.ts";
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
