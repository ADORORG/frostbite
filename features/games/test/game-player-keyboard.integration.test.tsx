// @vitest-environment jsdom

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  flush,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";

registerHarness();

// A game hears the keyboard only in its own frame. The page does not move focus there (the first Tab belongs to its skip link); it
// tells a connected game about the keys pressed while the page itself has the keyboard.
const press = (type: "keydown" | "keyup", code: string, init = {}) => {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    code,
    ...init,
  });
  act(() => void document.body.dispatchEvent(event));
  return event;
};
const forwardedTo = (reply: { mock: { calls: unknown[][] } }) =>
  reply.mock.calls
    .map(([message]) => message as { data?: unknown; event?: string })
    .filter(({ event }) => event === "key.forwarded")
    .map(({ data }) => data);

async function connected() {
  const player = await mount();
  send(player.target, "ready", { sdkVersion: 1 }, "a");
  await flush();
  return player;
}

describe("the keyboard in a game on the page", () => {
  it("reaches a connected game when the page has the keyboard, with no click first", async () => {
    const { reply } = await connected();
    press("keydown", "Enter");
    press("keyup", "Enter");
    expect(forwardedTo(reply)).toEqual([
      { code: "Enter", phase: "down", repeat: false },
      { code: "Enter", phase: "up", repeat: false },
    ]);
  });

  it("does not reach a game that has not connected yet, and does not stop the page scrolling for it", async () => {
    const { reply } = await mount();
    const space = press("keydown", "Space");
    expect(forwardedTo(reply)).toEqual([]);
    expect(space.defaultPrevented).toBe(false);
  });

  it("does not move the focus: the first Tab is still the page's", async () => {
    const { frame } = await connected();
    press("keydown", "Enter");
    expect(document.activeElement).not.toBe(frame);
  });

  it("stops the page scrolling for Space and the arrows it handed to the game, and for nothing else", async () => {
    await connected();
    for (const code of ["Space", "ArrowDown", "ArrowLeft"])
      expect(press("keydown", code).defaultPrevented).toBe(true);
    for (const code of ["Enter", "KeyW"])
      expect(press("keydown", code).defaultPrevented).toBe(false);
  });

  it("leaves Tab and Escape to the page", async () => {
    const { reply } = await connected();
    press("keydown", "Tab");
    press("keydown", "Escape");
    expect(forwardedTo(reply)).toEqual([]);
  });

  it("leaves the keys to a control that has the keyboard", async () => {
    const { reply } = await connected();
    const theatre = [...h.container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Theatre",
    );
    theatre?.focus();
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Enter",
    });
    act(() => void theatre?.dispatchEvent(event));
    expect(forwardedTo(reply)).toEqual([]);
  });

  it("stops listening when the player leaves the page: every key listener it added is removed", async () => {
    const added: [string, unknown][] = [];
    const removed: [string, unknown][] = [];
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation(
      (type: string, listener: unknown, options?: unknown) => {
        if (type.startsWith("key")) added.push([type, listener]);
        add(type, listener as EventListener, options as boolean);
      },
    );
    vi.spyOn(document, "removeEventListener").mockImplementation(
      (type: string, listener: unknown, options?: unknown) => {
        if (type.startsWith("key")) removed.push([type, listener]);
        remove(type, listener as EventListener, options as boolean);
      },
    );
    await connected();
    expect(added.map(([type]) => type).sort()).toEqual(["keydown", "keyup"]);
    act(() => h.root.unmount());
    expect(removed).toEqual(expect.arrayContaining(added));
  });
});
