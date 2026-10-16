import { describe, expect, it, vi } from "vitest";

import { createGameHost, type HostServices } from "../src/host.ts";
import { resolveGameHostPolicy } from "../src/policy.ts";
import type { EventMessage, Response, WalletInfo } from "../src/protocol.ts";
import {
  game,
  memoryBackend,
  outcome,
  request,
  taprootAddress,
  walletGame,
} from "./support.ts";

const wallet: WalletInfo = { address: taprootAddress, network: "signet" };

function setup(
  options: {
    game?: typeof game;
    push?: boolean;
    services?: HostServices;
    toastCalls?: number;
  } = {},
) {
  const replies: Response[] = [];
  const pushed: EventMessage[] = [];
  const host = createGameHost({
    backend: memoryBackend().backend,
    game: options.game ?? walletGame,
    policy: resolveGameHostPolicy(
      options.toastCalls === undefined
        ? {}
        : { toastCallsPerMinute: options.toastCalls },
    ),
    push:
      options.push === false ? undefined : (message) => pushed.push(message),
    reply: (response) => replies.push(response),
    services: options.services,
  });
  const send = async (method: string, params: unknown = {}, id = "r1") => {
    await host.handle(request(method, params, id));
    return replies.at(-1);
  };
  return { host, pushed, replies, send };
}
const ready = (s: ReturnType<typeof setup>) =>
  s.send("ready", { sdkVersion: 1 });

describe("the wallet", () => {
  it("is given to a game that declared the capability, as the address and network only", async () => {
    const s = setup({ services: { wallet: () => wallet } });
    await ready(s);
    expect(await s.send("wallet.get")).toMatchObject({
      ok: true,
      result: { wallet },
    });
  });

  it("is none while no wallet is connected, and none when the page cannot offer one", async () => {
    const connected = setup({ services: { wallet: () => null } });
    await ready(connected);
    expect(await connected.send("wallet.get")).toMatchObject({
      result: { wallet: null },
    });
    const unavailable = setup();
    await ready(unavailable);
    expect(await unavailable.send("wallet.get")).toMatchObject({
      result: { wallet: null },
    });
  });

  it("is refused to a game that did not declare it, however it asks, and the page is never asked", async () => {
    const wallet_ = vi.fn(() => wallet);
    for (const declared of [
      game,
      { ...game, capabilities: [] },
      { ...game, capabilities: ["balance:read"] },
    ]) {
      const s = setup({ game: declared, services: { wallet: wallet_ } });
      await ready(s);
      expect(outcome(await s.send("wallet.get"))).toBe("permission_denied");
    }
    expect(wallet_).not.toHaveBeenCalled();
  });

  it("is refused before the game has said ready", async () => {
    const s = setup({ services: { wallet: () => wallet } });
    expect(outcome(await s.send("wallet.get"))).toBe("not_ready");
  });

  it("never lets a value outside the wallet shape reach the game", async () => {
    const leaky = { ...wallet, publicKey: "02ab" } as unknown as WalletInfo;
    const s = setup({ services: { wallet: () => leaky } });
    await ready(s);
    expect(outcome(await s.send("wallet.get"))).toBe("unavailable");
  });
});

describe("the capabilities answer", () => {
  it("lists the methods, the events, what this game was granted and the limits", async () => {
    const s = setup();
    await ready(s);
    const reply = await s.send("capabilities.get");
    expect(reply).toMatchObject({
      ok: true,
      result: {
        granted: ["wallet"],
        limits: { progressMaxBytes: 65_536, toastMaxLength: 140 },
        protocolVersion: 1,
      },
    });
    const result = reply?.ok
      ? (reply.result as { events: string[]; methods: string[] })
      : null;
    expect(result?.methods).toContain("wallet.get");
    expect(result?.methods).toContain("capabilities.get");
    expect(result?.events.sort()).toEqual([
      "claim.changed",
      "fullscreen.changed",
      "lifecycle.changed",
      "player.changed",
      "wallet.changed",
    ]);
  });

  it("grants nothing to a game that declared nothing", async () => {
    const s = setup({ game });
    await ready(s);
    expect(await s.send("capabilities.get")).toMatchObject({
      result: { granted: [] },
    });
  });
});

describe("a message for the player", () => {
  it("is handed to the page, and the game is told it was shown", async () => {
    const toast = vi.fn();
    const s = setup({ services: { toast } });
    await ready(s);
    expect(
      await s.send("ui.toast", { message: "  Level up!  " }),
    ).toMatchObject({
      ok: true,
      result: { shown: true },
    });
    expect(toast).toHaveBeenCalledWith("Level up!");
  });

  it("is reported as not shown when the page has nowhere to show it", async () => {
    const s = setup();
    await ready(s);
    expect(await s.send("ui.toast", { message: "Hi" })).toMatchObject({
      result: { shown: false },
    });
  });

  it("is refused when empty or too long, and when sent too often", async () => {
    const toast = vi.fn();
    const s = setup({ services: { toast }, toastCalls: 2 });
    await ready(s);
    expect(outcome(await s.send("ui.toast", { message: "" }))).toBe(
      "invalid_request",
    );
    expect(
      outcome(await s.send("ui.toast", { message: "x".repeat(141) })),
    ).toBe("invalid_request");
    expect(outcome(await s.send("ui.toast", { message: "one" }))).toBe("ok");
    expect(outcome(await s.send("ui.toast", { message: "two" }))).toBe("ok");
    expect(outcome(await s.send("ui.toast", { message: "three" }))).toBe(
      "rate_limited",
    );
    expect(toast).toHaveBeenCalledTimes(2);
  });
});

describe("what the page tells the game", () => {
  it("is sent in the event shape, checked, once the game is ready", async () => {
    const s = setup();
    s.host.emit("lifecycle.changed", { state: "paused" });
    expect(s.pushed).toEqual([]);
    await ready(s);
    s.host.emit("lifecycle.changed", { state: "paused" });
    s.host.emit("fullscreen.changed", { active: true });
    expect(s.pushed).toEqual([
      {
        channel: "ador-game",
        data: { state: "paused" },
        event: "lifecycle.changed",
        version: 1,
      },
      {
        channel: "ador-game",
        data: { active: true },
        event: "fullscreen.changed",
        version: 1,
      },
    ]);
  });

  it("sends the wallet only to a game that declared it", async () => {
    const declared = setup();
    await ready(declared);
    declared.host.emit("wallet.changed", { wallet });
    expect(declared.pushed).toHaveLength(1);
    const undeclared = setup({ game });
    await ready(undeclared);
    undeclared.host.emit("wallet.changed", { wallet });
    expect(undeclared.pushed).toEqual([]);
  });

  it("does not send data that is not the event's shape", async () => {
    const s = setup();
    await ready(s);
    expect(() =>
      s.host.emit("wallet.changed", {
        wallet: { ...wallet, extra: 1 } as WalletInfo,
      }),
    ).toThrow();
    expect(s.pushed).toEqual([]);
  });

  it("is dropped, not failed, when the page gave the host nowhere to send it", async () => {
    const s = setup({ push: false });
    await ready(s);
    expect(() =>
      s.host.emit("fullscreen.changed", { active: false }),
    ).not.toThrow();
  });
});
