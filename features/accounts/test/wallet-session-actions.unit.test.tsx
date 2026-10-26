import { describe, expect, it } from "vitest";

import { createWalletSession } from "../src/client/wallet-session.ts";
import {
  address,
  challenge,
  challengeId,
  err,
  methods,
  server,
  wallet,
  walletId,
} from "./support/wallet-session.ts";

const other = "tb1qsecondwalletaddress000000000000000000";

describe("linking another wallet and signing again", () => {
  it("links the connected wallet to the signed-in account, and then says it is linked", async () => {
    let linked = false;
    const s = server({
      "/api/v1/auth/methods": () =>
        methods(linked ? [address, other] : [address]),
      "/api/v1/auth/wallet/link/challenge": () => challenge(),
      "/api/v1/auth/wallet/link/verify": () => {
        linked = true;
        return { changed: true };
      },
    });
    const session = createWalletSession({ request: s.request });
    session.setConnection(wallet({ address: other }));
    await session.refresh();
    expect(session.snapshot().view).toEqual({ kind: "not-linked" });
    expect(await session.link()).toBe(true);
    expect(s.calls[1]?.body).toEqual({
      address: other,
      network: "signet",
      walletAdapter: "xverse",
    });
    expect(session.snapshot().view).toEqual({ kind: "linked" });
    expect(session.snapshot().methods?.wallets).toHaveLength(2);
  });

  it("refuses to link a wallet that belongs elsewhere without saying more than that, and stays not linked", async () => {
    const s = server({
      "/api/v1/auth/methods": () => methods([address]),
      "/api/v1/auth/wallet/link/challenge": () => challenge(),
      "/api/v1/auth/wallet/link/verify": () =>
        err("conflict", 409, "wallet-on-another-account"),
    });
    const session = createWalletSession({ request: s.request });
    session.setConnection(wallet({ address: other }));
    await session.refresh();
    expect(await session.link()).toBe(false);
    expect(session.snapshot()).toMatchObject({
      failure: "wallet-on-another-account",
      view: { kind: "not-linked" },
    });
  });

  it("signs again to prove the player is here now, through its own routes", async () => {
    const s = server({
      "/api/v1/auth/methods": () => methods(),
      "/api/v1/auth/wallet/step-up/challenge": () => challenge(),
      "/api/v1/auth/wallet/step-up/verify": () => ({ changed: true }),
    });
    const session = createWalletSession({ request: s.request });
    session.setConnection(wallet());
    expect(await session.stepUp()).toBe(true);
    expect(s.calls.map(({ path }) => path)).toEqual([
      "/api/v1/auth/wallet/step-up/challenge",
      "/api/v1/auth/wallet/step-up/verify",
      "/api/v1/auth/methods",
    ]);
    expect(s.calls[1]?.body).toEqual({
      challengeId,
      signature: "the-signature",
    });
  });
});

describe("removing a wallet", () => {
  it("removes it and shows the account as it is now", async () => {
    let remaining = [address, other];
    const s = server({
      "/api/v1/auth/methods": () => methods(remaining),
      "/api/v1/auth/wallet/unlink": () => {
        remaining = [other];
        return { changed: true };
      },
    });
    const session = createWalletSession({ request: s.request });
    await session.refresh();
    expect(await session.unlink(walletId)).toBe(true);
    expect(s.calls.find(({ path }) => path.endsWith("/unlink"))?.body).toEqual({
      walletId,
    });
    expect(session.snapshot().methods?.wallets.map((w) => w.address)).toEqual([
      other,
    ]);
  });

  it.each([
    [
      "a session that is no longer recent",
      err("forbidden", 403, "recent-authentication-required"),
      "recent-authentication-required",
    ],
    [
      "the last way in",
      err("conflict", 409, "last-sign-in-method"),
      "last-sign-in-method",
    ],
    [
      "a wallet that is not there",
      err("not_found", 404, "wallet-missing"),
      "wallet-missing",
    ],
  ] as const)(
    "reports %s, and leaves the account as it was",
    async (_why, answer, failure) => {
      const s = server({
        "/api/v1/auth/methods": () => methods(),
        "/api/v1/auth/wallet/unlink": () => answer,
      });
      const session = createWalletSession({ request: s.request });
      await session.refresh();
      expect(await session.unlink(walletId)).toBe(false);
      expect(session.snapshot()).toMatchObject({ busy: null, failure });
      expect(session.snapshot().methods?.wallets).toHaveLength(1);
    },
  );
});

describe("an action while another runs", () => {
  it("refreshing while an action runs is ignored, and a refresh reports its own busy state", async () => {
    const s = server({ "/api/v1/auth/methods": () => methods() });
    const session = createWalletSession({ request: s.request });
    const seen: (string | null)[] = [];
    session.subscribe(() => seen.push(session.snapshot().busy));
    await session.refresh();
    expect(seen).toContain("refresh");
    expect(session.snapshot().busy).toBeNull();
  });
});
