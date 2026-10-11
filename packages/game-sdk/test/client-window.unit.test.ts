// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameClient } from "../src/client.ts";

afterEach(() => vi.restoreAllMocks());

// At the top of a window, `window.parent` is the window itself, so the page can play both parts.
describe("the client in a browser window", () => {
  it("talks to the window above it and hears answers from that window only", async () => {
    const client = createGameClient({ timeoutMs: 500 });
    const sent = vi.spyOn(window, "postMessage");
    const pending = client.player.info();
    expect(sent.mock.calls[0]?.[0]).toMatchObject({
      id: "r1",
      method: "player.info",
    });
    expect(sent.mock.calls[0]?.[1]).toBe("*");
    const answer = {
      channel: "ador-game",
      id: "r1",
      ok: true,
      result: { signedIn: true, walletConnected: false },
      version: 1,
    };
    window.dispatchEvent(
      new MessageEvent("message", { data: answer, source: null }),
    );
    window.dispatchEvent(
      new MessageEvent("message", { data: answer, source: window }),
    );
    await expect(pending).resolves.toEqual({
      signedIn: true,
      walletConnected: false,
    });
    client.dispose();
  });

  it("stops hearing the window when it is disposed", async () => {
    const remove = vi.spyOn(window, "removeEventListener");
    createGameClient().dispose();
    expect(remove).toHaveBeenCalledWith("message", expect.any(Function));
  });
});
