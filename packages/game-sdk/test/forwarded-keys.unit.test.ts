// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameClient } from "../src/client.ts";
import { attachKeys } from "../src/controls.ts";

afterEach(() => vi.restoreAllMocks());

// A game's keys are heard on its own window. The page cannot give a game the keyboard without taking the player's first Tab from the
// skip link, so it sends the key as a message and the client plays it back as the key event the game already listens for.
const message = (data: unknown, source: MessageEventSource | null = window) =>
  window.dispatchEvent(new MessageEvent("message", { data, source }));
const keyEvent = (code: string, phase: string, repeat = false) => ({
  channel: "frostbite-game",
  data: { code, phase, repeat },
  event: "key.forwarded",
  version: 1,
});

describe("a key forwarded by the page", () => {
  it("reaches a game that listens with attachKeys, exactly as if it had been pressed in the game", () => {
    const client = createGameClient();
    const heard: string[] = [];
    const stop = attachKeys(
      window,
      { Enter: "start", Space: "jump" },
      (action, phase) => heard.push(`${action}:${phase}`),
    );
    message(keyEvent("Enter", "down"));
    message(keyEvent("Space", "down"));
    message(keyEvent("Space", "up"));
    expect(heard).toEqual(["start:down", "jump:down", "jump:up"]);
    stop();
    client.dispose();
  });

  it("keeps the repeat flag, so a held key does not start again and again", () => {
    const client = createGameClient();
    const heard: string[] = [];
    const stop = attachKeys(window, { Enter: "start" }, (action, phase) =>
      heard.push(`${action}:${phase}`),
    );
    message(keyEvent("Enter", "down"));
    message(keyEvent("Enter", "down", true));
    expect(heard).toEqual(["start:down"]);
    stop();
    client.dispose();
  });

  it("is heard from the page above and from nothing else", () => {
    const client = createGameClient();
    const heard: string[] = [];
    const stop = attachKeys(window, { Enter: "start" }, (action) =>
      heard.push(action),
    );
    message(keyEvent("Enter", "down"), null);
    message(keyEvent("Enter", "down"), new MessageChannel().port1);
    expect(heard).toEqual([]);
    stop();
    client.dispose();
  });

  it("is dropped when it is not a key the protocol allows", () => {
    const client = createGameClient();
    const seen: string[] = [];
    const listen = (event: KeyboardEvent) => seen.push(event.code);
    window.addEventListener("keydown", listen);
    message(keyEvent("Tab", "down"));
    message(keyEvent("Enter", "sideways"));
    message({ ...keyEvent("Enter", "down"), data: "Enter" });
    expect(seen).toEqual([]);
    window.removeEventListener("keydown", listen);
    client.dispose();
  });

  it("stops once the client is disposed", () => {
    const client = createGameClient();
    const seen: string[] = [];
    const listen = (event: KeyboardEvent) => seen.push(event.code);
    window.addEventListener("keydown", listen);
    client.dispose();
    message(keyEvent("Enter", "down"));
    expect(seen).toEqual([]);
    window.removeEventListener("keydown", listen);
  });

  it("is still offered to a game that asks for the event itself", () => {
    const client = createGameClient();
    const heard: unknown[] = [];
    client.on("key.forwarded", (data) => heard.push(data));
    message(keyEvent("KeyW", "down"));
    expect(heard).toEqual([{ code: "KeyW", phase: "down", repeat: false }]);
    client.dispose();
  });
});
