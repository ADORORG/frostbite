import { ApiError } from "@ador/client-http";
import { describe, expect, it, vi } from "vitest";

import {
  createWalletSession,
  disconnected,
} from "../src/client/wallet-session.ts";
import { accountOutcomes } from "@ador/shared/account-outcomes";
import {
  address,
  challenge,
  challengeId,
  err,
  methods,
  server,
  signedOutServer,
  wallet,
  walletId,
} from "./support/wallet-session.ts";

describe("what the screen may say", () => {
  it("checks first, then says signed out, then connected once a wallet is, and is notified of each", async () => {
    const s = signedOutServer();
    const session = createWalletSession({ request: s.request });
    const seen: string[] = [];
    session.subscribe(() => seen.push(session.snapshot().view.kind));
    expect(session.snapshot().view).toEqual({ kind: "checking" });
    await session.refresh();
    expect(session.snapshot().view).toEqual({
      kind: "disconnected",
      signedIn: false,
    });
    session.setConnection(wallet());
    expect(session.snapshot().view).toEqual({ kind: "connected-signed-out" });
    expect(seen).toContain("connected-signed-out");
  });

  it("keeps one snapshot until something changes, and does not announce a connection that did not change", async () => {
    const session = createWalletSession({ request: signedOutServer().request });
    await session.refresh();
    const first = session.snapshot();
    expect(session.snapshot()).toBe(first);
    const listener = vi.fn();
    session.subscribe(listener);
    session.setConnection(disconnected);
    expect(listener).not.toHaveBeenCalled();
    session.setConnection(wallet());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.snapshot()).not.toBe(first);
    session.setConnection(wallet());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("says linked for a connected wallet the account has, and not linked for one it has not", async () => {
    const s = server({
      "/api/v1/auth/methods": () => methods(["tb1qsomeoneelse"]),
    });
    const session = createWalletSession({ request: s.request });
    session.setConnection(wallet());
    await session.refresh();
    expect(session.snapshot().view).toEqual({ kind: "not-linked" });
    session.setConnection(wallet({ address: "tb1qsomeoneelse" }));
    expect(session.snapshot().view).toEqual({ kind: "linked" });
    session.setConnection(disconnected);
    expect(session.snapshot().view).toEqual({
      kind: "disconnected",
      signedIn: true,
    });
    expect(session.snapshot().methods?.wallets).toHaveLength(1);
  });

  it("keeps what it knew when the check fails for a reason that is not 'nobody is signed in', and says why", async () => {
    let up = true;
    const s = server({
      "/api/v1/auth/methods": () => (up ? methods() : err("network", null)),
    });
    const session = createWalletSession({ request: s.request });
    await session.refresh();
    up = false;
    await session.refresh();
    expect(session.snapshot().view.kind).toBe("disconnected");
    expect(session.snapshot().methods).not.toBeNull();
    expect(session.snapshot().failure).toBe("network");
  });
});

describe("signing in", () => {
  it("asks for a challenge for the connected wallet, signs it, sends the signature back, and then asks who is signed in", async () => {
    let signedIn = false;
    const s = server({
      "/api/v1/auth/methods": () =>
        signedIn ? methods() : err("unauthorized", 401),
      "/api/v1/auth/wallet/challenge": () => challenge(),
      "/api/v1/auth/wallet/verify": () => {
        signedIn = true;
        return { signedIn: true };
      },
    });
    const connection = wallet();
    const session = createWalletSession({ request: s.request });
    session.setConnection(connection);
    await session.refresh();
    expect(await session.signIn()).toBe(true);
    expect(s.calls.map(({ path }) => path)).toEqual([
      "/api/v1/auth/methods",
      "/api/v1/auth/wallet/challenge",
      "/api/v1/auth/wallet/verify",
      "/api/v1/auth/methods",
    ]);
    expect(s.calls[1]?.body).toEqual({
      address,
      network: "signet",
      walletAdapter: "xverse",
    });
    expect(connection.signMessage).toHaveBeenCalledWith("sign this");
    expect(s.calls[2]?.body).toEqual({
      challengeId,
      signature: "the-signature",
    });
    expect(session.snapshot()).toMatchObject({
      busy: null,
      failure: null,
      view: { kind: "linked" },
    });
  });

  it("says busy while it works, and refuses a second action meanwhile without sending anything", async () => {
    let release: (value: string) => void = () => undefined;
    const slow = wallet({
      signMessage: () => new Promise<string>((resolve) => (release = resolve)),
    });
    const s = signedOutServer({
      "/api/v1/auth/wallet/challenge": () => challenge(),
      "/api/v1/auth/wallet/verify": () => ({ signedIn: true }),
    });
    const session = createWalletSession({ request: s.request });
    session.setConnection(slow);
    const first = session.signIn();
    await vi.waitFor(() => expect(session.snapshot().busy).toBe("sign-in"));
    expect(await session.signIn()).toBe(false);
    expect(await session.link()).toBe(false);
    expect(await session.stepUp()).toBe(false);
    expect(await session.unlink(walletId)).toBe(false);
    await session.refresh();
    expect(
      s.calls.filter(({ path }) => path.endsWith("/challenge")),
    ).toHaveLength(1);
    release("sig");
    await first;
    expect(session.snapshot().busy).toBeNull();
  });

  it("does nothing without a connected wallet", async () => {
    const s = signedOutServer();
    const session = createWalletSession({ request: s.request });
    expect(await session.signIn()).toBe(false);
    expect(session.snapshot().failure).toBe("wallet-not-connected");
    expect(s.calls).toEqual([]);
  });

  it("names the wallet software 'unknown' when the connection does not say", async () => {
    const s = signedOutServer({
      "/api/v1/auth/wallet/challenge": () => challenge(),
      "/api/v1/auth/wallet/verify": () => ({ signedIn: true }),
    });
    const session = createWalletSession({ request: s.request });
    session.setConnection(wallet({ provider: null }));
    await session.signIn();
    expect(s.calls[0]?.body).toMatchObject({ walletAdapter: "unknown" });
  });

  it.each([
    [
      "the player refuses to sign",
      {
        signMessage: async () => {
          throw new Error("rejected");
        },
      },
      "wallet-refused",
    ],
  ] as const)(
    "reports %s, and never sends a signature",
    async (_why, over, failure) => {
      const s = signedOutServer({
        "/api/v1/auth/wallet/challenge": () => challenge(),
      });
      const session = createWalletSession({ request: s.request });
      session.setConnection(wallet(over));
      expect(await session.signIn()).toBe(false);
      expect(session.snapshot()).toMatchObject({ busy: null, failure });
      expect(s.calls.some(({ path }) => path.endsWith("/verify"))).toBe(false);
    },
  );

  it.each([
    [
      "a signature the server will not accept",
      err("unauthorized", 401, "wallet-not-verified"),
      "wallet-not-verified",
    ],
    [
      "a wallet that cannot be used",
      err("conflict", 409, "wallet-unusable"),
      "wallet-unusable",
    ],
    [
      "a wallet already linked to a different account",
      err("conflict", 409, "wallet-on-another-account"),
      "wallet-on-another-account",
    ],
    [
      "a wallet recently removed from an account",
      err("conflict", 409, "wallet-held"),
      "wallet-held",
    ],
    [
      "a wallet that is not one of the account's",
      err("conflict", 409, "wallet-not-on-account"),
      "wallet-not-on-account",
    ],
    // An answer with no reason is taken as a signature that did not verify, never read from its words.
    ["a refusal with no reason", err("conflict", 409), "wallet-not-verified"],
    [
      "words that match a reason's but no reason",
      new ApiError("conflict", 409, accountOutcomes["wallet-held"].message),
      "wallet-not-verified",
    ],
    ["a request that never arrived", err("network", null), "network"],
  ] as const)(
    "reports %s from the server as %s, and the player is not signed in",
    async (_why, answer, failure) => {
      const s = signedOutServer({
        "/api/v1/auth/wallet/challenge": () => challenge(),
        "/api/v1/auth/wallet/verify": () => answer,
      });
      const session = createWalletSession({ request: s.request });
      session.setConnection(wallet());
      await session.refresh();
      expect(await session.signIn()).toBe(false);
      expect(session.snapshot()).toMatchObject({
        failure,
        view: { kind: "connected-signed-out" },
      });
    },
  );

  it.each([
    ["is switched to another wallet", { address: "tb1qanother" }],
    ["is disconnected", { connected: false }],
    ["is moved to another network", { network: "mainnet" as const }],
  ])(
    "discards the signature when the wallet %s while it is being signed",
    async (_why, change) => {
      const s = signedOutServer({
        "/api/v1/auth/wallet/challenge": () => challenge(),
      });
      const session = createWalletSession({ request: s.request });
      session.setConnection(
        wallet({
          signMessage: async () => {
            session.setConnection(wallet(change));
            return "sig";
          },
        }),
      );
      expect(await session.signIn()).toBe(false);
      expect(session.snapshot().failure).toBe("wallet-changed");
      expect(s.calls.some(({ path }) => path.endsWith("/verify"))).toBe(false);
    },
  );
});
