// @vitest-environment jsdom
import { act } from "react";
import { describe, expect, it } from "vitest";

import {
  address,
  answers,
  asks,
  balanceCard,
  chip,
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

describe("the wallet widget: the balance", () => {
  it("asks for the balance of the connected wallet as soon as it is connected, keeps it out of the chip, and shows it in the menu with the time it was read", async () => {
    Object.assign(connection, { address, connected: true });
    answers[balancePath] = () => ready(123_456);
    await show();
    await settle();
    expect(asks(balancePath)).toHaveLength(1);
    expect(asks(balancePath)[0]?.body).toEqual({ address, network: "signet" });
    // The chip is the wallet's short address and nothing longer.
    expect(chip()).toBe("tb1q9v…d45v");
    await openMenu();
    expect(balanceCard()).toContain("0.00123456");
    expect(balanceCard()).toContain("tBTC");
    expect(balanceCard()).toContain("123,456 sats · updated 12:34:56 UTC");
    // Opening the menu does not ask again.
    expect(asks(balancePath)).toHaveLength(1);
  });

  it("shows what is still waiting for its first confirmation apart from what can be spent", async () => {
    Object.assign(connection, { address, connected: true });
    answers[balancePath] = () => ready(0, 5_000_000);
    await show();
    await settle();
    await openMenu();
    expect(balanceCard()).toContain("0.00000000");
    expect(
      container.querySelector('[data-testid="pending-balance"]')?.textContent,
    ).toBe(
      "+ 0.05000000 tBTC (5,000,000 sats) still waiting for its first confirmation; a step cannot spend it yet.",
    );
  });

  it("will not start another read while one is under way, and says it is refreshing", async () => {
    Object.assign(connection, { address, connected: true });
    let answer: (response: Response) => void = () => undefined;
    answers[balancePath] = () =>
      new Promise<Response>((resolve) => (answer = resolve));
    await show();
    await settle();
    await openMenu();
    const refresh = () =>
      container.querySelector<HTMLButtonElement>(".wallet-balance__refresh");
    expect(refresh()?.disabled).toBe(true);
    expect(refresh()?.title).toBe("Refreshing…");
    expect(balanceCard()).toContain("Loading balance…");
    await act(async () => answer(ready(7)));
    await settle();
    expect(refresh()?.disabled).toBe(false);
    expect(refresh()?.title).toBe("Refresh balance");
  });

  it("says nothing of what is waiting when nothing is", async () => {
    Object.assign(connection, { address, connected: true });
    answers[balancePath] = () => ready(42, 0);
    await show();
    await settle();
    await openMenu();
    expect(
      container.querySelector('[data-testid="pending-balance"]'),
    ).toBeNull();
  });

  it("names the coin by the network: bitcoin on mainnet, tBTC on a test network", async () => {
    Object.assign(connection, { address, connected: true, network: "mainnet" });
    answers[balancePath] = () => ready(100_000_000);
    await show();
    await settle();
    await openMenu();
    const amount = container.querySelector(".wallet-balance__amount");
    expect(amount?.querySelector("strong")?.textContent).toBe("1.00000000");
    expect(amount?.querySelector("span")?.textContent).toBe("BTC");
    Object.assign(connection, { network: "signet" });
  });

  it("does not ask for the balance of a tab nobody is looking at, and asks once it shows", async () => {
    Object.assign(connection, { address, connected: true });
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
      await openMenu();
      expect(balanceCard()).toContain("0.00000042");
    } finally {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
      });
    }
  });

  it("asks for nothing while no wallet is connected, and says nothing about a balance", async () => {
    await show();
    await settle();
    expect(asks(balancePath)).toHaveLength(0);
    expect(chip()).toBe("Connect wallet");
    expect(container.querySelector(".wallet-balance")).toBeNull();
  });

  it("says why there is no balance instead of showing a zero, and refreshes when asked", async () => {
    Object.assign(connection, { address, connected: true });
    await show();
    await settle();
    // The chip says nothing of a balance; the menu says why there is none.
    expect(chip()).toBe("tb1q9v…d45v");
    await openMenu();
    const line = balanceCard;
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
    expect(line()).toContain("0.00000005");
    expect(line()).toContain(
      "5 sats · last read 12:34:56 UTC; could not update",
    );
    expect(asks(balancePath)).toHaveLength(5);
  });
});
