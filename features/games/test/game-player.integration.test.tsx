// @vitest-environment jsdom

import { gameChannel, protocolVersion } from "@ador/game-sdk/protocol";
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

async function mount() {
  await act(async () => {
    root.render(
      <GamePlayer
        game={game}
        src="/play/embedded-game/"
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
  it("frames the game with scripts only and no same-origin access", async () => {
    const { frame } = await mount();
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("allow")).toBe("fullscreen; autoplay; gamepad");
    expect(frame.getAttribute("src")).toBe("/play/embedded-game/");
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
});
