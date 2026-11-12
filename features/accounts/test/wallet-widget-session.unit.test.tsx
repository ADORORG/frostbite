// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { accountOutcomes } from "@frostbite/shared/account-outcomes";

import {
  address,
  answers,
  button,
  click,
  connection,
  container,
  denied,
  json,
  openMenu,
  requests,
  setSession,
  settle,
  show,
  signedOut,
} from "./support/widget-harness.tsx";

const signInLink = () =>
  container.querySelector<HTMLAnchorElement>(".wallet-widget__signin");
const noSessionActions = () => {
  for (const name of [
    "Sign in with wallet",
    "Link this wallet",
    "Sign again to confirm",
  ])
    expect(button(name)).toBeUndefined();
  expect(container.querySelector('[aria-label^="Remove"]')).toBeNull();
};

describe("the wallet widget: the session it is told of", () => {
  it("asks the server nothing about the session: it is what the page was rendered under", async () => {
    Object.assign(connection, { address, connected: true });
    setSession("signed-in");
    await show();
    await settle();
    await openMenu();
    expect(
      requests
        .map(({ path }) => path)
        // The balance and where "My profile" leads are asked for, neither of them about the session.
        .filter(
          (path) =>
            path !== "/api/v1/wallet/balance" && path !== "/api/v1/profile",
        ),
    ).toEqual([]);
  });

  it("offers a way to the sign-in page to anyone signed out, lit while a wallet is connected and waiting to be signed with", async () => {
    await show();
    await settle();
    expect(signInLink()?.getAttribute("href")).toBe("/sign-in");
    expect(signInLink()?.textContent).toBe("Sign in");
    expect(signInLink()?.dataset.waiting).toBeUndefined();
    Object.assign(connection, { address, connected: true });
    await show();
    await settle();
    expect(signInLink()?.dataset.waiting).toBe("true");
  });

  it("says a connected wallet is not a sign-in, and offers no way to sign in or manage wallets in the menu: that is the sign-in page's and the account page's", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    await show();
    await settle();
    await openMenu();
    expect(container.textContent).toContain("Not signed in.");
    noSessionActions();
    expect(button("Sign out")).toBeUndefined();
    expect(container.querySelector('a[href="/account"]')).toBeNull();
  });

  it("offers no sign-in link to someone signed in, and no session actions either, only a way to the account page and to sign out", async () => {
    Object.assign(connection, { address, connected: true });
    setSession("signed-in");
    await show();
    await settle();
    expect(signInLink()).toBeNull();
    await openMenu();
    expect(container.textContent).toContain("Signed in.");
    noSessionActions();
    expect(container.querySelector('a[href="/account"]')).not.toBeNull();
    expect(button("Sign out")).toBeDefined();
  });

  it("claims neither signed in nor signed out when the server could not tell", async () => {
    Object.assign(connection, { address, connected: true });
    setSession("unknown");
    await show();
    await settle();
    expect(signInLink()).toBeNull();
    await openMenu();
    expect(container.textContent).toContain("could not be checked");
    expect(button("Sign out")).toBeUndefined();
    expect(container.querySelector('a[href="/account"]')).toBeNull();
  });
});

describe("the wallet widget: signing out", () => {
  it("signs out, and asks the page to render again only after the server did", async () => {
    Object.assign(connection, { address, connected: true });
    setSession("signed-in");
    answers["/api/v1/auth/sign-out"] = () => json({ changed: true });
    await show();
    await settle();
    await openMenu();
    expect(signedOut).not.toHaveBeenCalled();
    await click("Sign out");
    expect(
      requests.filter(({ path }) => path === "/api/v1/auth/sign-out"),
    ).toHaveLength(1);
    expect(signedOut).toHaveBeenCalledTimes(1);
  });

  it("says why it did not work, and does not ask the page to render again", async () => {
    Object.assign(connection, { address, connected: true });
    setSession("signed-in");
    answers["/api/v1/auth/sign-out"] = () => denied("rate_limited", 429);
    await show();
    await settle();
    await openMenu();
    await click("Sign out");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      accountOutcomes["rate-limited"].message,
    );
    expect(signedOut).not.toHaveBeenCalled();
    expect(button("Sign out")).toBeDefined();
  });
});
