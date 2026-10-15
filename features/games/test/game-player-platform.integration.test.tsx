// @vitest-environment jsdom

import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { shortAddress } from "../src/ui/wallet-card.tsx";
import {
  flush,
  game,
  harness as h,
  mount,
  registerHarness,
  rerender,
  send,
} from "./support/player-harness.tsx";

registerHarness();

const address =
  "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqp3mvzv";
const connected = { address, network: "signet" };
const walletGame = { ...game, capabilities: ["wallet"] };
const connect = vi.fn();
beforeEach(() => connect.mockClear());
const asking = (current: typeof connected | null) => ({
  game: walletGame,
  wallet: { connect, current, expectedNetwork: "signet" as const },
});
const dockLabels = () =>
  [...h.container.querySelectorAll(".arcade-dock__strip button")].map(
    (button) => button.textContent,
  );
const sent = (reply: { mock: { calls: unknown[][] } }) =>
  reply.mock.calls.map(([message]) => message);
// The answer to the request with this id; answers can arrive in any order.
const answer = (reply: { mock: { calls: unknown[][] } }, id: string) =>
  sent(reply).find((message) => (message as { id?: string }).id === id);

describe("the wallet a game can see", () => {
  it("has no wallet section, and tells the game nothing, when the game did not ask", async () => {
    const { reply, target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "wallet.get", {}, "b");
    await flush();
    expect(dockLabels()).toEqual(["Milestones0/2"]);
    expect(answer(reply, "b")).toMatchObject({
      error: { code: "permission_denied" },
      ok: false,
    });
  });

  it("says no wallet is connected and where to connect one, and gives the game none", async () => {
    const { reply, target } = await mount(undefined, asking(null));
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "wallet.get", {}, "b");
    await flush();
    expect(dockLabels()).toEqual(["Milestones0/2", "Wallet"]);
    expect(h.container.textContent).toContain("No wallet is connected.");
    const connectButton = [...h.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Connect a wallet",
    );
    expect(connect).not.toHaveBeenCalled();
    await act(async () => connectButton?.click());
    expect(connect).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector('a[href="/sign-in"]')).toBeNull();
    expect(answer(reply, "b")).toMatchObject({
      ok: true,
      result: { wallet: null },
    });
  });

  it("gives the game the address and network of the connected wallet, and says so", async () => {
    const { reply, target } = await mount(undefined, asking(connected));
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "wallet.get", {}, "b");
    await flush();
    expect(dockLabels()).toEqual(["Milestones0/2", "WalletConnected"]);
    expect(h.container.textContent).toContain(shortAddress(address));
    expect(h.container.textContent).toContain("on signet");
    expect(h.container.textContent).toContain("This game can see this address");
    expect(answer(reply, "b")).toMatchObject({
      ok: true,
      result: { wallet: connected },
    });
  });

  it("opens the app's wallet chooser when the game asks for one, and not when a wallet is already connected", async () => {
    const { reply, target } = await mount(undefined, asking(null));
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "wallet.connect", {}, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      result: { status: "requested" },
    });
    expect(connect).toHaveBeenCalledTimes(1);
    await rerender(asking(connected));
    send(target, "wallet.connect", {}, "c");
    await flush();
    expect(answer(reply, "c")).toMatchObject({
      result: { status: "already-connected" },
    });
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("tells a game that asks for a wallet on a page with no chooser that there is none", async () => {
    const { reply, target } = await mount(undefined, {
      game: walletGame,
      wallet: undefined,
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "wallet.connect", {}, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      ok: true,
      result: { status: "unavailable" },
    });
  });

  it("warns, on the card, when the connected wallet is on another network than the game uses, and still lets the game see it", async () => {
    const mainnet = { address, network: "mainnet" };
    const { reply, target } = await mount(undefined, {
      game: walletGame,
      wallet: { connect, current: mainnet, expectedNetwork: "signet" },
    });
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "wallet.get", {}, "b");
    await flush();
    expect(h.container.textContent).toContain(
      "⚠ Mainnet — this game uses Signet",
    );
    expect(answer(reply, "b")).toMatchObject({ result: { wallet: mainnet } });
    await rerender(asking(connected));
    expect(h.container.textContent).not.toContain("this game uses");
  });

  it("tells the game when the wallet connects or leaves, without restarting it", async () => {
    const { reply, target } = await mount(undefined, asking(null));
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    const started = h.started.length;
    await rerender(asking(connected));
    await rerender(asking(null));
    const events = sent(reply).filter(
      (message) => "event" in (message as object),
    );
    expect(events).toEqual([
      {
        channel: "ador-game",
        data: { wallet: connected },
        event: "wallet.changed",
        version: 1,
      },
      {
        channel: "ador-game",
        data: { wallet: null },
        event: "wallet.changed",
        version: 1,
      },
    ]);
    expect(h.started.length).toBe(started);
  });

  it("answers with the wallet as it is when asked, even if it connected after the game started", async () => {
    const { reply, target } = await mount(undefined, asking(null));
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    await rerender(asking(connected));
    send(target, "wallet.get", {}, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({ result: { wallet: connected } });
  });
});

describe("what a game can ask the page to show", () => {
  it("shows its message under its own name, so it cannot pass for the platform's", async () => {
    const { reply, target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "ui.toast", { message: "Level up!" }, "b");
    await flush();
    expect(answer(reply, "b")).toMatchObject({
      ok: true,
      result: { shown: true },
    });
    expect(
      h.container.querySelector('[data-testid="milestone-toast"]')?.textContent,
    ).toBe("Embedded game: Level up!");
  });
});

describe("what the page tells the game about its surroundings", () => {
  const events = (reply: { mock: { calls: unknown[][] } }) =>
    sent(reply).filter((message) => "event" in (message as object));

  it("says when the tab is hidden and shown again", async () => {
    const { reply, target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    const hidden = (value: boolean) =>
      Object.defineProperty(document, "hidden", { configurable: true, value });
    hidden(true);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    hidden(false);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(events(reply)).toMatchObject([
      { data: { state: "paused" }, event: "lifecycle.changed" },
      { data: { state: "active" }, event: "lifecycle.changed" },
    ]);
  });

  it("says when the game's frame enters or leaves full screen, and not when something else does", async () => {
    const { frame, reply, target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    const fullscreen = (element: Element | null) =>
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: element,
      });
    fullscreen(frame);
    act(() => void document.dispatchEvent(new Event("fullscreenchange")));
    fullscreen(document.body);
    act(() => void document.dispatchEvent(new Event("fullscreenchange")));
    fullscreen(null);
    act(() => void document.dispatchEvent(new Event("fullscreenchange")));
    expect(events(reply)).toMatchObject([
      { data: { active: true }, event: "fullscreen.changed" },
      { data: { active: false }, event: "fullscreen.changed" },
      { data: { active: false }, event: "fullscreen.changed" },
    ]);
  });
});
