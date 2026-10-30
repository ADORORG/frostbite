// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { attachKeys, standardKeys, type Phase } from "../src/controls.ts";
import { createPause, pauseCopy } from "../src/pause.ts";

afterEach(() => document.body.replaceChildren());

function press(
  code: string,
  init: KeyboardEventInit = {},
  on: EventTarget = window,
) {
  const down = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code,
    ...init,
  });
  on.dispatchEvent(down);
  const up = new KeyboardEvent("keyup", {
    bubbles: true,
    cancelable: true,
    code,
    ...init,
  });
  on.dispatchEvent(up);
  return { down, up };
}

function listen(keys: Record<string, string> = standardKeys) {
  const seen: [string, Phase][] = [];
  const detach = attachKeys(window, keys, (action, phase) =>
    seen.push([action, phase]),
  );
  return { detach, seen };
}

describe("a game's keys", () => {
  it("start on Enter, pause on P, and tell down from up", () => {
    const { detach, seen } = listen();
    press("Enter");
    press("NumpadEnter");
    press("KeyP");
    detach();
    expect(seen).toEqual([
      ["start", "down"],
      ["start", "up"],
      ["start", "down"],
      ["start", "up"],
      ["pause", "down"],
      ["pause", "up"],
    ]);
  });

  it("add the game's own keys, and let it take Enter or P for something else", () => {
    const { detach, seen } = listen({
      ...standardKeys,
      ArrowLeft: "left",
      Enter: "drop",
      Space: "jump",
    });
    press("ArrowLeft");
    press("Enter");
    press("Space");
    press("KeyQ");
    detach();
    expect(seen.map(([action]) => action)).toEqual([
      "left",
      "left",
      "drop",
      "drop",
      "jump",
      "jump",
    ]);
  });

  it("do not repeat while a key is held, but still say when it comes up", () => {
    const { detach, seen } = listen();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyP", repeat: true }),
    );
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyP" }));
    detach();
    expect(seen).toEqual([["pause", "up"]]);
  });

  it("stop the page from scrolling or pressing a focused button, whether or not the key repeats", () => {
    const { detach } = listen({ Space: "jump" });
    const { down, up } = press("Space");
    const repeated = new KeyboardEvent("keydown", {
      cancelable: true,
      code: "Space",
      repeat: true,
    });
    window.dispatchEvent(repeated);
    detach();
    expect(down.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it("leave a key the game does not use to the browser", () => {
    const { detach, seen } = listen();
    const { down } = press("Tab");
    detach();
    expect(down.defaultPrevented).toBe(false);
    expect(seen).toEqual([]);
  });

  it("leave browser shortcuts alone", () => {
    const { detach, seen } = listen();
    for (const init of [
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
    ]) {
      const { down } = press("KeyP", init);
      expect(down.defaultPrevented).toBe(false);
    }
    detach();
    expect(seen).toEqual([]);
  });

  it("leave typing in a field alone", () => {
    const field = document.createElement("input");
    const area = document.createElement("textarea");
    const choice = document.createElement("select");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.append(field, area, choice, editable);
    const { detach, seen } = listen();
    for (const element of [field, area, choice, editable]) {
      const { down } = press("KeyP", {}, element);
      expect(down.defaultPrevented).toBe(false);
    }
    detach();
    expect(seen).toEqual([]);
  });

  it("act on a key pressed on a button, which is where the focus is after a click", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const { detach, seen } = listen();
    press("Enter", {}, button);
    detach();
    expect(seen[0]).toEqual(["start", "down"]);
  });

  it("stop listening when detached", () => {
    const { detach, seen } = listen();
    detach();
    press("Enter");
    expect(seen).toEqual([]);
  });

  it("ignore a key that only looks like an action name on the table's prototype", () => {
    const { detach, seen } = listen();
    press("constructor");
    press("toString");
    detach();
    expect(seen).toEqual([]);
  });
});

describe("pausing", () => {
  it("starts running, flips on toggle, and tells listeners only when it changes", () => {
    const pause = createPause();
    const told: boolean[] = [];
    pause.subscribe((value) => told.push(value));
    expect(pause.paused()).toBe(false);
    pause.set(false);
    pause.toggle();
    expect(pause.paused()).toBe(true);
    pause.set(true);
    pause.toggle();
    expect(told).toEqual([true, false]);
  });

  it("tells only the listeners it had when the change happened", () => {
    const pause = createPause();
    const told: string[] = [];
    pause.subscribe(() => {
      told.push("first");
      pause.subscribe(() => told.push("late"));
    });
    pause.toggle();
    expect(told).toEqual(["first"]);
  });

  it("stops telling a listener that unsubscribed, even from inside a notice", () => {
    const pause = createPause();
    const told: string[] = [];
    const stop = pause.subscribe(() => {
      told.push("a");
      stop();
    });
    pause.subscribe(() => told.push("b"));
    pause.toggle();
    pause.toggle();
    expect(told).toEqual(["a", "b", "b"]);
  });
});

describe("the words for pausing", () => {
  it("name the button for each state and say how to carry on", () => {
    expect(pauseCopy.pause).not.toBe(pauseCopy.resume);
    expect(pauseCopy.paused).toContain("P");
  });
});
