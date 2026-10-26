// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it } from "vitest";

import { accountOutcomes } from "@ador/shared/account-outcomes";

import {
  address,
  answers,
  button,
  challenge,
  click,
  connection,
  container,
  denied,
  json,
  methods,
  openMenu,
  requests,
  sessionChanged,
  second,
  settle,
  show,
} from "./support/widget-harness.tsx";

describe("the wallet widget: signing in", () => {
  it("signs the player in with the connected wallet, and says so only once the server has said who is signed in", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    let signedIn = false;
    Object.assign(answers, {
      "/api/v1/auth/methods": () =>
        signedIn ? methods([address]) : denied("unauthorized", 401),
      "/api/v1/auth/wallet/challenge": challenge,
      "/api/v1/auth/wallet/verify": () => {
        signedIn = true;
        return json({ signedIn: true });
      },
    });
    await show();
    await settle();
    await openMenu();
    expect(container.textContent).toContain("Connected, not signed in.");
    expect(container.textContent).not.toContain("Signed in with this wallet");
    expect(sessionChanged).not.toHaveBeenCalled();
    await click("Sign in with wallet");
    // The page is told, once, so it can show what the new session may see.
    expect(sessionChanged).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Signed in with this wallet.");
    expect(button("Sign out")).toBeDefined();
    expect(
      requests
        .map(({ path }) => path)
        .filter((path) => path !== "/api/v1/wallet/balance"),
    ).toEqual([
      "/api/v1/auth/methods",
      "/api/v1/auth/wallet/challenge",
      "/api/v1/auth/wallet/verify",
      "/api/v1/auth/methods",
    ]);
  });

  it("does not ask the page to refresh when signing in did not work", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => denied("unauthorized", 401),
      "/api/v1/auth/wallet/challenge": challenge,
      "/api/v1/auth/wallet/verify": () =>
        denied("unauthorized", 401, "wallet-not-verified"),
    });
    await show();
    await settle();
    await openMenu();
    await click("Sign in with wallet");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      accountOutcomes["wallet-not-verified"].message,
    );
    expect(sessionChanged).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Connected, not signed in.");
  });

  it("says a connected wallet is not linked, offers to link it, and says what went wrong in plain words when it cannot be", async () => {
    Object.assign(connection, {
      address: second,
      connected: true,
      provider: "xverse",
    });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
      "/api/v1/auth/wallet/link/challenge": challenge,
      "/api/v1/auth/wallet/link/verify": () =>
        denied("conflict", 409, "wallet-unusable"),
    });
    await show();
    await settle();
    await openMenu();
    expect(container.textContent).toContain(
      "This wallet is not linked to your account",
    );
    await click("Link this wallet");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "This wallet cannot be used for that.",
    );
    expect(button("Link this wallet")).toBeDefined();
    // Nothing changed about who is signed in, so the page is not asked to refresh.
    expect(sessionChanged).not.toHaveBeenCalled();
  });

  it.each([
    ["is already linked to a different account", "wallet-on-another-account"],
    ["was recently removed from an account", "wallet-held"],
    ["is not one of the account's wallets", "wallet-not-on-account"],
  ] as const)(
    "says why a wallet cannot be linked when it %s, not a vague refusal",
    async (_why, outcome) => {
      Object.assign(connection, {
        address: second,
        connected: true,
        provider: "xverse",
      });
      Object.assign(answers, {
        "/api/v1/auth/methods": () => methods([address]),
        "/api/v1/auth/wallet/link/challenge": challenge,
        "/api/v1/auth/wallet/link/verify": () =>
          denied("conflict", 409, outcome),
      });
      await show();
      await settle();
      await openMenu();
      await click("Link this wallet");
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        accountOutcomes[outcome].message,
      );
      expect(container.textContent).not.toContain("cannot be used for that");
    },
  );

  it("lists the wallets that sign in, lets one be removed only while another remains, and says why the last cannot be", async () => {
    Object.assign(connection, { address, connected: true });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
    });
    await show();
    await settle();
    await openMenu();
    expect(container.textContent).toContain("only way to sign in");
    expect(container.querySelector('[aria-label^="Remove"]')).toBeNull();
  });

  it("offers removal when there are two wallets, and asks to sign again when the change needs a recent signature", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address, second]),
      "/api/v1/auth/wallet/unlink": () =>
        denied("forbidden", 403, "recent-authentication-required"),
    });
    await show();
    await settle();
    await openMenu();
    expect(container.textContent).not.toContain("only way to sign in");
    expect(container.querySelectorAll('[aria-label^="Remove"]')).toHaveLength(
      2,
    );
    await act(async () =>
      container
        .querySelector(
          `[aria-label="Remove ${second.slice(0, 6)}…${second.slice(-4)}"]`,
        )
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      accountOutcomes["recent-authentication-required"].message,
    );
    expect(button("Sign again to confirm")).toBeDefined();
  });

  it("signs out, and goes back to saying nobody is signed in", async () => {
    Object.assign(connection, { address, connected: true });
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
      "/api/v1/auth/sign-out": () => json({ changed: true }),
    });
    await show();
    await settle();
    await openMenu();
    await click("Sign out");
    expect(sessionChanged).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Connected, not signed in.");
    expect(container.textContent).not.toContain("Your wallets");
  });

  it("offers a way to the sign-in page to anyone signed out, lit while a wallet is connected and waiting to be signed with", async () => {
    const link = () =>
      container.querySelector<HTMLAnchorElement>(".wallet-widget__signin");
    Object.assign(answers, {
      "/api/v1/auth/methods": () => denied("unauthorized", 401),
    });
    await show();
    await settle();
    expect(link()?.getAttribute("href")).toBe("/sign-in");
    expect(link()?.textContent).toBe("Sign in");
    expect(link()?.dataset.waiting).toBeUndefined();
    Object.assign(connection, { address, connected: true });
    await show();
    await settle();
    expect(link()?.dataset.waiting).toBe("true");
  });

  it("offers no sign-in link to someone who is signed in, nor before the session has been read", async () => {
    const link = () => container.querySelector(".wallet-widget__signin");
    Object.assign(answers, {
      "/api/v1/auth/methods": () => methods([address]),
    });
    await show();
    // Not yet read: neither signed in nor signed out is known, so nothing is claimed either way.
    expect(link()).toBeNull();
    await settle();
    expect(link()).toBeNull();
    Object.assign(connection, { address, connected: true });
    await show();
    await settle();
    expect(link()).toBeNull();
  });
});
