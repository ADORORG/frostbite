// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { gameChannel, protocolVersion } from "../src/protocol.ts";
import {
  click,
  log,
  mount,
  state,
  panel,
  useDevPage,
} from "./dev-host-page-harness.ts";

useDevPage();

describe("mounting the test page", () => {
  it("puts the game in a sandboxed frame, starts it only once the host is listening, and says the platform here is made up", () => {
    mount();
    const frame = document.querySelector("iframe");
    expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame?.getAttribute("allow")).toContain("fullscreen");
    expect(state.recordedSrc).toEqual(["/play/tiny-game/index.html"]);
    expect(panel()).toContain("Signed out");
    expect(panel()).toContain("No wallet connected");
    expect(panel()).toContain("Claims (simulated)");
  });

  it("answers the game through the real host, and logs each request and answer, newest first", async () => {
    const { ask } = mount();
    expect(await ask("ready", { sdkVersion: 1 })).toMatchObject({ ok: true });
    expect(await ask("player.info")).toMatchObject({
      ok: true,
      result: { signedIn: false, walletConnected: false },
    });
    expect(log()[0]).toContain("← player.info");
    expect(log()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("→ ready"),
        expect.stringContaining("← ready"),
      ]),
    );
  });

  it("logs what the host refuses, and says why", async () => {
    const { ask } = mount({ capabilities: [] });
    await ask("ready", { sdkVersion: 1 });
    expect(await ask("wallet.get")).toMatchObject({
      error: { code: "permission_denied" },
      ok: false,
    });
    expect(log().join("\n")).toContain("wallet.get refused: permission_denied");
    expect(log().join("\n")).toContain("wallet.get permission_denied:");
  });

  it("ignores messages that did not come from the game's frame, and ones that are not the protocol's", async () => {
    const { toGame } = mount();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          channel: gameChannel,
          id: "x",
          method: "ready",
          params: { sdkVersion: 1 },
          version: protocolVersion,
        },
        source: window,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: "hello",
        source: state.page?.frame.contentWindow ?? null,
      }),
    );
    await Promise.resolve();
    expect(toGame).not.toHaveBeenCalled();
    expect(log()).toEqual([]);
  });

  it("keeps the log to the most recent entries", async () => {
    const { ask } = mount();
    await ask("ready", { sdkVersion: 1 });
    // A hundred and ten calls, each a request and an answer: more than the log keeps.
    for (let call = 0; call < 110; call += 1)
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            channel: gameChannel,
            id: `m${String(call)}`,
            method: "capabilities.get",
            params: {},
            version: protocolVersion,
          },
          source: state.page?.frame.contentWindow ?? null,
        }),
      );
    await vi.waitFor(() => expect(log()[0]).toContain("← capabilities.get"));
    await new Promise((wake) => setTimeout(wake, 50));
    expect(log()).toHaveLength(200);
  });
});

describe("the player and the wallet", () => {
  it("tells the game when the player signs in and out, with the account's id and then this browser's", async () => {
    const { ask, pushed } = mount();
    await ask("ready", { sdkVersion: 1 });
    await click("dev-signin");
    await vi.waitFor(() =>
      expect(pushed().at(-1)).toMatchObject({
        data: { kind: "account" },
        event: "player.changed",
      }),
    );
    expect(panel()).toContain("Signed in");
    await click("dev-signin");
    await vi.waitFor(() =>
      expect(pushed().at(-1)).toMatchObject({
        data: { kind: "local" },
        event: "player.changed",
      }),
    );
    expect(await ask("player.identity")).toMatchObject({
      result: { kind: "local" },
    });
  });

  it("connects and moves a wallet, telling a game that declared the wallet capability", async () => {
    const { ask, pushed } = mount();
    await ask("ready", { sdkVersion: 1 });
    await click("dev-wallet");
    expect(pushed().at(-1)).toMatchObject({
      data: { wallet: { network: "signet" } },
      event: "wallet.changed",
    });
    expect(await ask("wallet.get")).toMatchObject({
      result: { wallet: { network: "signet" } },
    });
    const select = document.getElementById("dev-network");
    if (!(select instanceof HTMLSelectElement))
      throw new Error("no network choice");
    select.value = "mainnet";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(pushed().at(-1)).toMatchObject({
      data: { wallet: { network: "mainnet" } },
      event: "wallet.changed",
    });
    expect(panel()).toContain("on mainnet");
    await click("dev-wallet");
    expect(pushed().at(-1)).toMatchObject({
      data: { wallet: null },
      event: "wallet.changed",
    });
  });

  it("connects the wallet when the game asks the platform to", async () => {
    const { ask } = mount();
    await ask("ready", { sdkVersion: 1 });
    expect(await ask("wallet.connect")).toMatchObject({
      result: { status: "requested" },
    });
    expect(panel()).toContain("on signet");
    expect(await ask("wallet.connect")).toMatchObject({
      result: { status: "already-connected" },
    });
  });

  it("tells the game about the tab being hidden and full screen", async () => {
    const { ask, pushed } = mount();
    await ask("ready", { sdkVersion: 1 });
    await click("dev-hidden");
    expect(pushed().at(-1)).toMatchObject({
      data: { state: "paused" },
      event: "lifecycle.changed",
    });
    expect(document.getElementById("dev-hidden")?.textContent).toBe("Show tab");
    await click("dev-hidden");
    expect(pushed().at(-1)).toMatchObject({
      data: { state: "active" },
      event: "lifecycle.changed",
    });
    await click("dev-fullscreen");
    expect(pushed().at(-1)).toMatchObject({
      data: { active: true },
      event: "fullscreen.changed",
    });
    expect(document.getElementById("dev-fullscreen")?.textContent).toBe(
      "Leave full screen",
    );
  });
});
