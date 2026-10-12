// @vitest-environment jsdom

import { gameChannel, protocolVersion } from "@ador/game-sdk/protocol";
import type { AccountPort } from "@ador/game-sdk/synced-backend";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GamePlayer } from "../src/ui/game-player.tsx";
import { embeddedGame } from "./support/template-game.ts";

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});

let container: HTMLElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const game = { id: embeddedGame.id, milestones: embeddedGame.milestones };
const send = (
  source: unknown,
  method: string,
  params: unknown = {},
  id = "r1",
) =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        channel: gameChannel,
        id,
        method,
        params,
        version: protocolVersion,
      },
      source: source as MessageEventSource,
    }),
  );
const flush = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

// jsdom replaces the frame's window when it is given an address, which a browser does not. So the address is
// recorded instead of followed, and `atStart` runs at the moment the game would begin.
const original = HTMLIFrameElement.prototype.setAttribute;
const started: string[] = [];
let atStart: (() => void) | undefined;
const signedOut: AccountPort = { sync: async () => ({ kind: "signed-out" }) };
// A stable function, as the page passes: a new one each render would restart the session.
const noAccount = () => signedOut;
async function mount(accountFor: (gameId: string) => AccountPort = noAccount) {
  started.length = 0;
  vi.spyOn(HTMLIFrameElement.prototype, "setAttribute").mockImplementation(
    function (this: HTMLIFrameElement, name: string, value: string) {
      if (name !== "src") return original.call(this, name, value);
      started.push(value);
      atStart?.();
    },
  );
  await act(async () => {
    root.render(
      <GamePlayer
        accountFor={accountFor}
        game={game}
        src="/play/embedded-game/index.html"
        title="Embedded game"
      />,
    );
  });
  const frame = container.querySelector("iframe");
  if (frame === null || frame.contentWindow === null)
    throw new Error("No frame");
  const reply = vi.spyOn(frame.contentWindow, "postMessage");
  return { frame, reply, target: frame.contentWindow };
}

describe("the game player", () => {
  it("starts the game only once the host is listening, so its first message is answered", async () => {
    let answered = 0;
    atStart = () => {
      const frame = container.querySelector("iframe");
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
    atStart = undefined;
    expect(started).toEqual(["/play/embedded-game/index.html"]);
    expect(answered).toBe(1);
  });

  it("frames the game with scripts only and no same-origin access", async () => {
    const { frame } = await mount();
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("allow")).toBe("fullscreen; autoplay; gamepad");
    expect(frame.getAttribute("data-game-src")).toBe(
      "/play/embedded-game/index.html",
    );
    expect(started).toEqual(["/play/embedded-game/index.html"]);
    expect(container.textContent).toContain("Connecting");
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
    expect(container.textContent).toContain("Connected to the platform");
  });

  it("ignores a message from any window but the frame's", async () => {
    const { reply } = await mount();
    send(window, "ready", { sdkVersion: 1 });
    send(null, "ready", { sdkVersion: 1 });
    await flush();
    expect(reply).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Connecting");
  });

  it("keeps a milestone the game unlocks, shows it, and shows it again after a reload", async () => {
    const first = await mount();
    send(first.target, "ready", { sdkVersion: 1 }, "a");
    send(first.target, "milestones.unlock", { id: "first-level" }, "b");
    await flush();
    expect(
      container.querySelector('[data-milestone="first-level"]')?.textContent,
    ).toContain("reached");
    expect(
      container.querySelector('[data-milestone="century"]')?.textContent,
    ).toContain("not yet");
    expect(
      window.localStorage.getItem("ador:game:embedded-game:milestones"),
    ).toContain("first-level");
    act(() => root.unmount());
    root = createRoot(container);
    await mount();
    await flush();
    expect(
      container.querySelector('[data-milestone="first-level"]')?.textContent,
    ).toContain("reached");
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
    expect(container.textContent).toContain("blocking storage");
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it("says progress is kept when storage works", async () => {
    await mount();
    await flush();
    expect(container.textContent).toContain("kept in this browser");
  });

  it("stops listening when the page goes away", async () => {
    const { reply, target } = await mount();
    act(() => root.unmount());
    send(target, "ready", { sdkVersion: 1 });
    await flush();
    expect(reply).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it("does not restart the game when the page hands it a different function for reaching the account", async () => {
    await mount();
    await act(async () => {
      root.render(
        <GamePlayer
          accountFor={() => signedOut}
          game={game}
          src="/play/embedded-game/index.html"
          title="Embedded game"
        />,
      );
    });
    await flush();
    expect(started).toEqual(["/play/embedded-game/index.html"]);
  });

  it("says progress is kept in this browser only when nobody is signed in", async () => {
    await mount();
    await flush();
    expect(container.textContent).toContain(
      "Your progress is kept in this browser only.",
    );
  });

  describe("with an account", () => {
    const merged = {
      milestones: [
        {
          id: game.milestones[0]?.id ?? "",
          unlockedAt: "2026-10-01T00:00:00.000Z",
          verification: "self-reported",
        },
      ],
      progress: { savedAt: "2026-10-02T00:00:00.000Z", state: { taps: 7 } },
    } as const;

    it("starts the game from the account's state and says the progress is saved there", async () => {
      const sync = vi.fn<AccountPort["sync"]>(async () => ({
        kind: "synced",
        state: merged,
      }));
      const accountFor = () => ({ sync });
      const { reply, target } = await mount(accountFor);
      send(target, "ready", { sdkVersion: 1 });
      send(target, "progress.load", {}, "r2");
      await flush();
      expect(reply.mock.calls[1]?.[0]).toMatchObject({
        ok: true,
        result: { state: { taps: 7 } },
      });
      expect(container.textContent).toContain(
        "Your progress is saved to your account and kept in this browser.",
      );
      expect(container.textContent).toContain("reached 2026-10-01");
    });

    it("sends a save made in the game to the account", async () => {
      const sync = vi.fn<AccountPort["sync"]>(async () => ({
        kind: "synced",
        state: merged,
      }));
      const accountFor = () => ({ sync });
      const { target } = await mount(accountFor);
      send(target, "ready", { sdkVersion: 1 });
      send(target, "progress.save", { state: { taps: 8 } }, "r2");
      await flush();
      expect(sync.mock.calls.at(-1)?.[0].progress?.state).toEqual({ taps: 8 });
    });

    it("says saving to the account is waiting when it cannot be reached, and the game still plays", async () => {
      const accountFor = () => ({
        sync: async () => ({ kind: "failed" as const }),
      });
      const { reply, target } = await mount(accountFor);
      send(target, "ready", { sdkVersion: 1 });
      send(target, "progress.save", { state: { taps: 1 } }, "r2");
      await flush();
      expect(reply.mock.calls[1]?.[0]).toMatchObject({ ok: true });
      expect(container.textContent).toContain(
        "Saving it to your account is waiting for a connection.",
      );
    });
  });
});
