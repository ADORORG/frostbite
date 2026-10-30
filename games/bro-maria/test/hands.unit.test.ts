// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachHands } from "../src/screen/controls.ts";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

function setup() {
  const root = document.createElement("div");
  const buttons = (["left", "right", "jump"] as const).map((control) => {
    const button = document.createElement("button");
    button.dataset.hold = control;
    root.append(button);
    return button;
  });
  document.body.append(root);
  const hands = { hold: vi.fn(), pause: vi.fn(), start: vi.fn() };
  stops.push(attachHands(root, hands));
  return { buttons, hands, root };
}
const key = (type: "keydown" | "keyup", code: string, repeat = false) =>
  window.dispatchEvent(
    new KeyboardEvent(type, { cancelable: true, code, repeat }),
  );
const touch = (target: Element, type: string) =>
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true }),
  );

describe("the player's hands", () => {
  it("run on the arrows and A and D, and jump on up, W and space, holding while the key is down", () => {
    const { hands } = setup();
    for (const [code, control] of [
      ["ArrowLeft", "left"],
      ["KeyA", "left"],
      ["ArrowRight", "right"],
      ["KeyD", "right"],
      ["ArrowUp", "jump"],
      ["KeyW", "jump"],
      ["Space", "jump"],
    ] as const) {
      key("keydown", code);
      expect(hands.hold).toHaveBeenLastCalledWith(control, true);
      key("keyup", code);
      expect(hands.hold).toHaveBeenLastCalledWith(control, false);
    }
  });

  it("start on Enter and pause on P, on the press and not the release", () => {
    const { hands } = setup();
    key("keydown", "Enter");
    key("keyup", "Enter");
    key("keydown", "KeyP");
    key("keyup", "KeyP");
    expect(hands.start).toHaveBeenCalledTimes(1);
    expect(hands.pause).toHaveBeenCalledTimes(1);
    expect(hands.hold).not.toHaveBeenCalled();
  });

  it("ignore a key held down, and a key that is not for the game", () => {
    const { hands } = setup();
    key("keydown", "KeyD");
    key("keydown", "KeyD", true);
    key("keydown", "KeyQ");
    expect(hands.hold).toHaveBeenCalledTimes(1);
  });

  it("hold a control while a touch button is down, and let go of it when the finger lifts, is cancelled or leaves", () => {
    const { buttons, hands } = setup();
    const [left, right, jump] = buttons;
    if (left === undefined || right === undefined || jump === undefined)
      throw new Error("buttons");
    touch(right, "pointerdown");
    expect(hands.hold).toHaveBeenLastCalledWith("right", true);
    touch(right, "pointerup");
    expect(hands.hold).toHaveBeenLastCalledWith("right", false);
    touch(jump, "pointerdown");
    touch(jump, "pointercancel");
    expect(hands.hold).toHaveBeenLastCalledWith("jump", false);
    touch(left, "pointerdown");
    touch(left, "pointerleave");
    expect(hands.hold).toHaveBeenLastCalledWith("left", false);
    expect(hands.hold).toHaveBeenCalledTimes(6);
  });

  it("take a touch only on a button that names a control", () => {
    const { hands, root } = setup();
    const stray = document.createElement("button");
    const odd = document.createElement("button");
    odd.dataset.hold = "fly";
    root.append(stray, odd);
    touch(stray, "pointerdown");
    touch(odd, "pointerdown");
    touch(root, "pointerdown");
    expect(hands.hold).not.toHaveBeenCalled();
  });

  it("let go of every control when the page loses focus, since no release would be seen", () => {
    const { hands } = setup();
    window.dispatchEvent(new Event("blur"));
    expect(hands.hold.mock.calls.map((call) => call.join())).toEqual([
      "jump,false",
      "left,false",
      "right,false",
    ]);
  });

  it("stop listening when told to", () => {
    const { buttons, hands } = setup();
    for (const stop of stops.splice(0)) stop();
    key("keydown", "KeyD");
    key("keydown", "Enter");
    window.dispatchEvent(new Event("blur"));
    for (const button of buttons) touch(button, "pointerdown");
    expect(hands.hold).not.toHaveBeenCalled();
    expect(hands.start).not.toHaveBeenCalled();
  });
});
