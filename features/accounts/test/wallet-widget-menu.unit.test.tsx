// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  address,
  answers,
  asks,
  button,
  chooser,
  click,
  connection,
  container,
  json,
  methods,
  openMenu,
  remembered,
  settle,
  show,
  trigger,
} from "./support/widget-harness.tsx";

const balancePath = "/api/v1/wallet/balance";
afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("the wallet widget: the button", () => {
  it("is one button that opens the wallet chooser when no wallet is connected and nobody is signed in", async () => {
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    expect(trigger()?.textContent).toBe("Connect wallet");
    expect(trigger()?.hasAttribute("aria-expanded")).toBe(false);
    await act(async () => trigger()?.click());
    expect(chooser.request).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".wallet-menu")).toBeNull();
  });

  it("shows the connected wallet's picture and short address, and opens a menu that names itself", async () => {
    Object.assign(connection, { address, connected: true, provider: "xverse" });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    expect(trigger()?.textContent).toContain(
      `${address.slice(0, 8)}…${address.slice(-8)}`,
    );
    expect(trigger()?.querySelector("svg.avatar")).not.toBeNull();
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
    await openMenu();
    expect(trigger()?.getAttribute("aria-expanded")).toBe("true");
    const menu = container.querySelector(".wallet-menu");
    expect(menu?.id).toBe(trigger()?.getAttribute("aria-controls"));
    expect(menu?.textContent).toContain(address);
    expect(menu?.textContent).toContain("xverse · Signet");
    expect(chooser.request).not.toHaveBeenCalled();
  });

  it("closes the menu with Escape and puts focus back on the button, and closes it when the page is clicked elsewhere", async () => {
    Object.assign(connection, { address, connected: true });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    await openMenu();
    const key = (target: Element, name: string) =>
      act(async () =>
        target.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: name }),
        ),
      );
    await key(container.querySelector(".wallet-menu") ?? container, "a");
    expect(container.querySelector(".wallet-menu")).not.toBeNull();
    await key(container.querySelector(".wallet-menu") ?? container, "Escape");
    expect(container.querySelector(".wallet-menu")).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await openMenu();
    await act(async () =>
      container
        .querySelector(".wallet-menu")
        ?.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(container.querySelector(".wallet-menu")).not.toBeNull();
    await act(async () =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(container.querySelector(".wallet-menu")).toBeNull();
  });

  it("warns on the button and in the menu when the wallet is on another network than the platform", async () => {
    Object.assign(connection, { address, connected: true, network: "mainnet" });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    expect(trigger()?.dataset.mismatch).toBe("true");
    expect(
      trigger()?.querySelector('[aria-label="Wrong network"]'),
    ).not.toBeNull();
    await openMenu();
    expect(container.querySelector(".wallet-menu__warning")?.textContent).toBe(
      "⚠ Mainnet — this platform uses Signet",
    );
    Object.assign(connection, { network: "signet" });
  });

  it("is an account menu when signed in with no wallet connected, and can ask for a wallet from there", async () => {
    answers["/api/v1/auth/methods"] = () => methods([address]);
    await show();
    await settle();
    expect(trigger()?.textContent).toBe("Account");
    await openMenu();
    expect(container.textContent).toContain("Signed in with this wallet.");
    expect(container.querySelector(".wallet-menu__identity")).toBeNull();
    expect(asks(balancePath)).toHaveLength(0);
    await click("Connect wallet");
    expect(chooser.request).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".wallet-menu")).toBeNull();
  });

  it("switches and disconnects the wallet from the menu, and links to the account page for passkeys", async () => {
    Object.assign(connection, { address, connected: true });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    await openMenu();
    expect(container.querySelector('a[href="/account"]')?.textContent).toBe(
      "Account and passkeys",
    );
    await click("Disconnect wallet");
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
    await click("Switch wallet");
    expect(chooser.request).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".wallet-menu")).toBeNull();
  });
});

describe("the wallet widget: copying the address", () => {
  const copyWith = async (writeText: (text: string) => Promise<void>) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.assign(connection, { address, connected: true });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    await openMenu();
    await click("Copy address");
  };

  it("says Copied only after the browser accepted the address", async () => {
    const writeText = vi.fn(async () => undefined);
    await copyWith(writeText);
    expect(writeText).toHaveBeenCalledWith(address);
    expect(container.textContent).toContain("Copied");
  });

  it("says so when the browser refuses", async () => {
    await copyWith(async () => Promise.reject(new Error("denied")));
    expect(container.textContent).toContain("Could not copy");
    expect(container.textContent).not.toContain("Copied");
    expect(button("Copy address")).toBeDefined();
  });
});

describe("the wallet widget: a wallet coming back after a reload", () => {
  it("says it is reconnecting, not 'Account' or 'Connect wallet', while a remembered wallet is on its way", async () => {
    remembered.value = true;
    answers["/api/v1/auth/methods"] = () => methods([address]);
    await show();
    await settle();
    expect(trigger()?.textContent).toBe("Reconnecting wallet…");
    expect(trigger()?.getAttribute("aria-busy")).toBe("true");
    // It is the wallet that arrives, and the label becomes the wallet.
    Object.assign(connection, { address, connected: true });
    await show();
    expect(trigger()?.textContent).toContain(
      `${address.slice(0, 8)}…${address.slice(-8)}`,
    );
    expect(trigger()?.hasAttribute("aria-busy")).toBe(false);
  });

  it("gives up after the wait and shows what is true: an account, or no wallet", async () => {
    vi.useFakeTimers();
    try {
      remembered.value = true;
      answers["/api/v1/auth/methods"] = () => methods([address]);
      await show();
      await act(async () => vi.advanceTimersByTimeAsync(9_999));
      expect(trigger()?.textContent).toBe("Reconnecting wallet…");
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(trigger()?.textContent).toBe("Account");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not claim to be reconnecting when no wallet is remembered", async () => {
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    expect(trigger()?.textContent).toBe("Connect wallet");
    expect(trigger()?.hasAttribute("aria-busy")).toBe(false);
  });
});
