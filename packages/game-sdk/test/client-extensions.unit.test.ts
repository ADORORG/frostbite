import { describe, expect, it, vi } from "vitest";

import { GameHostError, createGameClient } from "../src/client.ts";
import { taprootAddress } from "./support.ts";

type Listener = (event: { data: unknown; source: unknown }) => void;

function pair() {
  const listeners = new Set<Listener>();
  const sent: { id: string; method: string; params: unknown }[] = [];
  const host = {
    postMessage: (message: unknown) =>
      void sent.push(message as (typeof sent)[number]),
  };
  const listenOn = {
    addEventListener: (_t: "message", l: Listener) => listeners.add(l),
    removeEventListener: (_t: "message", l: Listener) => listeners.delete(l),
  };
  const deliver = (data: unknown, source: unknown = host) =>
    listeners.forEach((l) => l({ data, source }));
  const client = createGameClient({ host, listenOn, timeoutMs: 500 });
  const reply = (result: unknown) =>
    deliver({
      channel: "frostbite-game",
      id: sent.at(-1)?.id,
      ok: true,
      result,
      version: 1,
    });
  const event = (name: string, data: unknown, source: unknown = host) =>
    deliver(
      { channel: "frostbite-game", data, event: name, version: 1 },
      source,
    );
  return { client, deliver, event, host, listeners, reply, sent };
}

describe("the wallet, the capabilities and the message", () => {
  const wallet = { address: taprootAddress, network: "signet" };

  it("reads the connected wallet, or none", async () => {
    const p = pair();
    const connected = p.client.wallet.get();
    expect(p.sent.at(-1)).toMatchObject({ method: "wallet.get", params: {} });
    p.reply({ wallet });
    await expect(connected).resolves.toEqual(wallet);
    const none = p.client.wallet.get();
    p.reply({ wallet: null });
    await expect(none).resolves.toBeNull();
  });

  it("asks the platform to open its wallet chooser and says what the platform did", async () => {
    const p = pair();
    for (const status of ["requested", "already-connected", "unavailable"]) {
      const asked = p.client.wallet.connect();
      expect(p.sent.at(-1)).toMatchObject({
        method: "wallet.connect",
        params: {},
      });
      p.reply({ status });
      await expect(asked).resolves.toBe(status);
    }
    const odd = p.client.wallet.connect();
    p.reply({ status: "opened" });
    await expect(odd).rejects.toBeDefined();
  });

  it("reports a refusal as an error with the platform's code", async () => {
    const p = pair();
    const pending = p.client.wallet.get();
    p.deliver({
      channel: "frostbite-game",
      error: { code: "permission_denied", message: "No." },
      id: p.sent.at(-1)?.id,
      ok: false,
      version: 1,
    });
    await expect(pending).rejects.toMatchObject({
      code: "permission_denied",
      name: "GameHostError",
    });
    await expect(pending).rejects.toBeInstanceOf(GameHostError);
  });

  it("asks what the platform supports", async () => {
    const p = pair();
    const pending = p.client.capabilities.get();
    expect(p.sent.at(-1)?.method).toBe("capabilities.get");
    const answer = {
      events: ["wallet.changed"],
      granted: ["wallet"],
      limits: { progressMaxBytes: 65_536, toastMaxLength: 140 },
      methods: ["wallet.get"],
      protocolVersion: 1,
    };
    p.reply(answer);
    await expect(pending).resolves.toEqual(answer);
  });

  it("asks for a message to be shown and says whether it was", async () => {
    const p = pair();
    const shown = p.client.ui.toast("Level up!");
    expect(p.sent.at(-1)).toMatchObject({
      method: "ui.toast",
      params: { message: "Level up!" },
    });
    p.reply({ shown: true });
    await expect(shown).resolves.toBe(true);
    const hidden = p.client.ui.toast("Again");
    p.reply({ shown: false });
    await expect(hidden).resolves.toBe(false);
  });
});

describe("what the platform tells the game", () => {
  it("reaches every handler for that event, with its data", () => {
    const p = pair();
    const first = vi.fn();
    const second = vi.fn();
    p.client.on("lifecycle.changed", first);
    p.client.on("lifecycle.changed", second);
    p.event("lifecycle.changed", { state: "paused" });
    expect(first).toHaveBeenCalledWith({ state: "paused" });
    expect(second).toHaveBeenCalledWith({ state: "paused" });
  });

  it("does not reach a handler for another event", () => {
    const p = pair();
    const handler = vi.fn();
    p.client.on("fullscreen.changed", handler);
    p.event("lifecycle.changed", { state: "paused" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("stops reaching a handler once it is removed, and all of them when the client is closed", () => {
    const p = pair();
    const removed = vi.fn();
    const kept = vi.fn();
    const stop = p.client.on("fullscreen.changed", removed);
    p.client.on("fullscreen.changed", kept);
    stop();
    p.event("fullscreen.changed", { active: true });
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
    p.client.dispose();
    expect(p.listeners.size).toBe(0);
  });

  it("ignores a message from anywhere but the host", () => {
    const p = pair();
    const handler = vi.fn();
    p.client.on("fullscreen.changed", handler);
    p.event("fullscreen.changed", { active: true }, {});
    p.event("fullscreen.changed", { active: true }, null);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    ["an event nobody defined", "teapot", { active: true }],
    ["an inherited name", "constructor", { active: true }],
    ["data of the wrong shape", "fullscreen.changed", { active: "yes" }],
    ["data with an extra field", "fullscreen.changed", { active: true, x: 1 }],
  ])("ignores %s", (_why, name, data) => {
    const p = pair();
    const handler = vi.fn();
    p.client.on("fullscreen.changed", handler);
    p.event(name, data);
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores a message that is not an event at all", () => {
    const p = pair();
    const handler = vi.fn();
    p.client.on("fullscreen.changed", handler);
    p.deliver({
      channel: "frostbite-game",
      event: "fullscreen.changed",
      data: { active: true },
      version: 2,
    });
    p.deliver("text");
    expect(handler).not.toHaveBeenCalled();
  });
});
