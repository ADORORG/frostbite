import { describe, expect, it, vi } from "vitest";

import { createGameHost, type HostServices } from "../src/host.ts";
import { resolveGameHostPolicy } from "../src/policy.ts";
import type { Response, WalletInfo } from "../src/protocol.ts";
import {
  game,
  memoryBackend,
  request,
  taprootAddress,
  walletGame,
} from "./support.ts";

const connected: WalletInfo = { address: taprootAddress, network: "signet" };

function setup(
  options: {
    connectCalls?: number;
    game?: typeof game;
    services?: HostServices;
  } = {},
) {
  const replies: Response[] = [];
  const host = createGameHost({
    backend: memoryBackend().backend,
    game: options.game ?? walletGame,
    policy: resolveGameHostPolicy(
      options.connectCalls === undefined
        ? {}
        : { connectCallsPerMinute: options.connectCalls },
    ),
    push: () => undefined,
    reply: (response) => replies.push(response),
    services: options.services,
  });
  const connect = async (id = "c1") => {
    await host.handle(request("wallet.connect", {}, id));
    return replies.at(-1);
  };
  return {
    connect,
    ready: () => host.handle(request("ready", { sdkVersion: 1 }, "r")),
  };
}

describe("asking the page to open the wallet chooser", () => {
  it("opens it when no wallet is connected, once per ask, and says it was requested", async () => {
    const connectWallet = vi.fn();
    const s = setup({ services: { connectWallet, wallet: () => null } });
    await s.ready();
    expect(await s.connect()).toMatchObject({
      ok: true,
      result: { status: "requested" },
    });
    expect(connectWallet).toHaveBeenCalledTimes(1);
  });

  it("does not open it when a wallet is already connected, and says so", async () => {
    const connectWallet = vi.fn();
    const s = setup({ services: { connectWallet, wallet: () => connected } });
    await s.ready();
    expect(await s.connect()).toMatchObject({
      result: { status: "already-connected" },
    });
    expect(connectWallet).not.toHaveBeenCalled();
  });

  it("says it is unavailable when the page has no chooser to open", async () => {
    const s = setup({ services: { wallet: () => null } });
    await s.ready();
    expect(await s.connect()).toMatchObject({
      ok: true,
      result: { status: "unavailable" },
    });
    const bare = setup();
    await bare.ready();
    expect(await bare.connect()).toMatchObject({
      result: { status: "unavailable" },
    });
  });

  it("is refused to a game that did not declare the wallet capability, and the page is never asked", async () => {
    const connectWallet = vi.fn();
    for (const declared of [
      game,
      { ...game, capabilities: ["balance:read"] },
    ]) {
      const s = setup({ game: declared, services: { connectWallet } });
      await s.ready();
      expect(await s.connect()).toMatchObject({
        error: { code: "permission_denied" },
        ok: false,
      });
    }
    expect(connectWallet).not.toHaveBeenCalled();
  });

  it("is limited per minute, so a game cannot keep a dialog in the player's way", async () => {
    const connectWallet = vi.fn();
    const s = setup({
      connectCalls: 2,
      services: { connectWallet, wallet: () => null },
    });
    await s.ready();
    expect(await s.connect("a")).toMatchObject({ ok: true });
    expect(await s.connect("b")).toMatchObject({ ok: true });
    expect(await s.connect("c")).toMatchObject({
      error: { code: "rate_limited" },
      ok: false,
    });
    expect(connectWallet).toHaveBeenCalledTimes(2);
  });

  it("is refused before the game says it is ready, like every other call", async () => {
    const connectWallet = vi.fn();
    const s = setup({ services: { connectWallet, wallet: () => null } });
    expect(await s.connect()).toMatchObject({ ok: false });
    expect(connectWallet).not.toHaveBeenCalled();
  });
});
