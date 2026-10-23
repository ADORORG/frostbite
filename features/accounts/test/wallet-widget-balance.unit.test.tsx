// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it } from "vitest";

import {
  address,
  answers,
  asks,
  click,
  connection,
  container,
  json,
  openMenu,
  settle,
  show,
} from "./support/widget-harness.tsx";

const balancePath = "/api/v1/wallet/balance";
const ready = (satoshis: number, pendingSats = 0) =>
  json({
    asOf: "2026-10-15T12:34:56.000Z",
    pendingSats,
    satoshis,
    status: "ready",
  });
const headerBalance = () =>
  container.querySelector(".wallet-widget__balance")?.textContent ?? "";

describe("the wallet widget: the balance", () => {
  it("asks for the balance of the connected wallet as soon as it is connected, and shows it in the header with the time it was read", async () => {
    Object.assign(connection, { address, connected: true });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    answers[balancePath] = () => ready(123_456);
    await show();
    await settle();
    expect(asks(balancePath)).toHaveLength(1);
    expect(asks(balancePath)[0]?.body).toEqual({ address, network: "signet" });
    expect(headerBalance()).toBe("0.00123456 tBTC");
    expect(
      container.querySelector(".wallet-widget__balance")?.getAttribute("title"),
    ).toBe("Spendable now. Read 12:34:56 UTC.");
    expect(container.querySelector(".wallet-widget__pending")).toBeNull();
    await openMenu();
    expect(
      container.querySelector(".wallet-menu__balance")?.textContent,
    ).toContain("0.00123456 tBTC (123,456 sats) Updated 12:34:56 UTC.");
    // Opening the menu does not ask again.
    expect(asks(balancePath)).toHaveLength(1);
  });

  it("shows what is still waiting for its first confirmation apart from what can be spent, in the header and the menu", async () => {
    Object.assign(connection, { address, connected: true });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    answers[balancePath] = () => ready(0, 5_000_000);
    await show();
    await settle();
    expect(headerBalance()).toBe("0.00000000 tBTC");
    const pending = container.querySelector(".wallet-widget__pending");
    expect(pending?.textContent).toBe("+0.05000000 pending");
    expect(pending?.getAttribute("title")).toContain("5,000,000 sats");
    await openMenu();
    expect(
      container.querySelector('[data-testid="pending-balance"]')?.textContent,
    ).toContain("0.05000000 tBTC (5,000,000 sats) still waiting");
  });

  it("names the coin by the network: bitcoin on mainnet, tBTC on a test network", async () => {
    Object.assign(connection, { address, connected: true, network: "mainnet" });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    answers[balancePath] = () => ready(100_000_000);
    await show();
    await settle();
    expect(headerBalance()).toBe("1.00000000 BTC");
    Object.assign(connection, { network: "signet" });
  });

  it("does not ask for the balance of a tab nobody is looking at, and asks once it shows", async () => {
    Object.assign(connection, { address, connected: true });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    answers[balancePath] = () => ready(42);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    try {
      await show();
      await settle();
      expect(asks(balancePath)).toHaveLength(0);
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await settle();
      expect(asks(balancePath)).toHaveLength(1);
      expect(headerBalance()).toBe("0.00000042 tBTC");
    } finally {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
    }
  });

  it("asks for nothing while no wallet is connected, and says nothing about a balance", async () => {
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    expect(asks(balancePath)).toHaveLength(0);
    expect(container.querySelector(".wallet-widget__balance")).toBeNull();
  });

  it("says why there is no balance instead of showing a zero, and refreshes when asked", async () => {
    Object.assign(connection, { address, connected: true });
    answers["/api/v1/auth/methods"] = () => json({}, 401);
    await show();
    await settle();
    // The header says only that there is none; the menu says why.
    expect(headerBalance()).toBe("balance unavailable");
    await openMenu();
    const line = () =>
      container.querySelector(".wallet-menu__balance")?.textContent ?? "";
    expect(line()).toContain(
      "Balance unavailable: no data source is configured.",
    );
    expect(line()).not.toMatch(/BTC|sats/u);
    answers[balancePath] = () =>
      json({ reason: "source-failed", status: "unavailable" });
    await click("Refresh balance");
    expect(line()).toContain("the data source did not answer");
    answers[balancePath] = () => json({}, 500);
    await click("Refresh balance");
    expect(line()).toContain("Balance could not be loaded.");
    answers[balancePath] = () => ready(5);
    await click("Refresh balance");
    answers[balancePath] = () => json({}, 500);
    await click("Refresh balance");
    expect(line()).toContain("0.00000005 tBTC (5 sats)");
    expect(line()).toContain("Last read 12:34:56 UTC; could not update.");
    expect(headerBalance()).toContain("(old)");
    expect(asks(balancePath)).toHaveLength(5);
  });
});
