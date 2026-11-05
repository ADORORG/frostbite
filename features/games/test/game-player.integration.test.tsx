// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { GamePlayer } from "../src/ui/game-player.tsx";

import {
  flush,
  game,
  harness as h,
  mount,
  send,
  signedOut,
  registerHarness,
} from "./support/player-harness.tsx";

registerHarness();

describe("the game player", () => {
  it("starts the game only once the host is listening, so its first message is answered", async () => {
    let answered = 0;
    h.atStart = () => {
      const frame = h.container.querySelector("iframe");
      vi.spyOn(
        frame?.contentWindow as Window,
        "postMessage",
      ).mockImplementation(() => {
        answered += 1;
      });
      send(frame?.contentWindow, "ready", { sdkVersion: 1 });
    };
    await mount();
    await flush();
    h.atStart = undefined;
    expect(h.started).toEqual(["/play/embedded-game/index.html"]);
    expect(answered).toBe(1);
  });

  it("frames the game with scripts only and no same-origin access", async () => {
    const { frame } = await mount();
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("allow")).toBe("fullscreen; autoplay; gamepad");
    expect(frame.getAttribute("data-game-src")).toBe(
      "/play/embedded-game/index.html",
    );
    expect(h.started).toEqual(["/play/embedded-game/index.html"]);
    expect(h.container.textContent).toContain("Connecting");
  });

  it("answers the game that is in the frame, and shows it connected", async () => {
    const { reply, target } = await mount();
    send(target, "ready", { sdkVersion: 1 });
    await flush();
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0]?.[0]).toMatchObject({
      id: "r1",
      ok: true,
      result: { gameId: "embedded-game" },
    });
    expect(reply.mock.calls[0]?.[1]).toBe("*");
    expect(h.container.textContent).toContain("Connected to the platform");
  });

  it("ignores a message from any window but the frame's", async () => {
    const { reply } = await mount();
    send(window, "ready", { sdkVersion: 1 });
    send(null, "ready", { sdkVersion: 1 });
    await flush();
    expect(reply).not.toHaveBeenCalled();
    expect(h.container.textContent).toContain("Connecting");
  });

  it("keeps a milestone the game unlocks, shows it, and shows it again after a reload", async () => {
    const first = await mount();
    send(first.target, "ready", { sdkVersion: 1 }, "a");
    send(first.target, "milestones.unlock", { id: "first-level" }, "b");
    await flush();
    const earned = h.container.querySelector('[data-milestone="first-level"]');
    expect(earned?.getAttribute("data-state")).toBe("earned");
    expect(earned?.textContent).toContain("Reached");
    expect(earned?.textContent).toContain("Reported by the game on");
    expect(earned?.textContent).toContain("cannot be minted yet");
    const waiting = h.container.querySelector('[data-milestone="century"]');
    expect(waiting?.getAttribute("data-state")).toBe("not-earned");
    expect(waiting?.textContent).toContain("Not yet");
    // The card stays short: detail is for what has been reached.
    expect(waiting?.textContent).not.toContain("Not reported by the game yet");
    expect(
      h.container.querySelector('[data-testid="milestone-summary"]')
        ?.textContent,
    ).toBe("1 of 2 reached");
    expect(
      window.localStorage.getItem("frostbite:game:embedded-game:milestones"),
    ).toContain("first-level");
    act(() => h.root.unmount());
    h.root = createRoot(h.container);
    await mount();
    await flush();
    expect(
      h.container
        .querySelector('[data-milestone="first-level"]')
        ?.getAttribute("data-state"),
    ).toBe("earned");
  });

  it("announces progress on the milestones politely, so a screen reader hears a new one", async () => {
    await mount();
    await flush();
    const summary = h.container.querySelector(
      '[data-testid="milestone-summary"]',
    );
    expect(summary?.getAttribute("aria-live")).toBe("polite");
    expect(summary?.getAttribute("role")).toBe("status");
  });

  it("saves progress for the game and gives it back", async () => {
    const { reply, target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    send(target, "progress.save", { state: { score: 3 } }, "b");
    await flush();
    send(target, "progress.load", {}, "c");
    await flush();
    expect(reply.mock.calls.at(-1)?.[0]).toMatchObject({
      id: "c",
      ok: true,
      result: { state: { score: 3 } },
    });
  });

  it("says nothing will be kept when the browser blocks storage, and still plays", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { reply, target } = await mount();
    send(target, "ready", { sdkVersion: 1 });
    await flush();
    expect(h.container.textContent).toContain("blocking storage");
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it("says progress is kept when storage works", async () => {
    await mount();
    await flush();
    expect(h.container.textContent).toContain("kept in this browser");
  });

  it("stops listening when the page goes away", async () => {
    const { reply, target } = await mount();
    act(() => h.root.unmount());
    send(target, "ready", { sdkVersion: 1 });
    await flush();
    expect(reply).not.toHaveBeenCalled();
    h.root = createRoot(h.container);
  });

  it("does not restart the game when the page hands it a different function for reaching the account", async () => {
    await mount();
    await act(async () => {
      h.root.render(
        <GamePlayer
          accountFor={() => signedOut}
          game={game}
          src="/play/embedded-game/index.html"
          title="Embedded game"
        />,
      );
    });
    await flush();
    expect(h.started).toEqual(["/play/embedded-game/index.html"]);
  });

  it("says progress is kept in this browser only when nobody is signed in", async () => {
    await mount();
    await flush();
    expect(h.container.textContent).toContain(
      "Your progress is kept in this browser only.",
    );
  });
});
