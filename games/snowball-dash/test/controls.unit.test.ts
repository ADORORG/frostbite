// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachControls } from "../src/screen/controls.ts";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

function setup() {
  const target = document.createElement("div");
  document.body.append(target);
  const controls = { pause: vi.fn(), press: vi.fn() };
  stops.push(attachControls(target, controls));
  return { controls, target };
}
const key = (
  type: "keydown" | "keyup",
  code: string,
  init: KeyboardEventInit = {},
) => {
  const event = new KeyboardEvent(type, { cancelable: true, code, ...init });
  window.dispatchEvent(event);
  return event;
};

describe("the one button", () => {
  it("goes down on Space, the up arrow and Enter, and comes up when the key does", () => {
    const { controls } = setup();
    for (const code of ["Space", "ArrowUp", "Enter", "NumpadEnter"]) {
      key("keydown", code);
      expect(controls.press).toHaveBeenLastCalledWith(true);
      key("keyup", code);
      expect(controls.press).toHaveBeenLastCalledWith(false);
    }
    expect(controls.press).toHaveBeenCalledTimes(8);
    expect(controls.pause).not.toHaveBeenCalled();
  });

  it("is held down without repeating, and Space is the button and never the pause", () => {
    const { controls } = setup();
    expect(key("keydown", "Space").defaultPrevented).toBe(true);
    key("keydown", "Space", { repeat: true });
    expect(controls.press).toHaveBeenCalledTimes(1);
    expect(controls.pause).not.toHaveBeenCalled();
  });

  it("leaves keys it does not know, shortcuts, and typing in a field alone", () => {
    const { controls } = setup();
    key("keydown", "KeyQ");
    key("keydown", "Space", { ctrlKey: true });
    const field = document.createElement("input");
    document.body.append(field);
    field.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, code: "Space" }),
    );
    expect(controls.press).not.toHaveBeenCalled();
  });

  it("goes down on a touch on the screen, comes up when the touch ends or is lost anywhere, and stops listening when told", () => {
    const { controls, target } = setup();
    const down = new MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(down);
    expect(controls.press).toHaveBeenLastCalledWith(true);
    expect(down.defaultPrevented).toBe(true);
    window.dispatchEvent(new MouseEvent("pointerup"));
    expect(controls.press).toHaveBeenLastCalledWith(false);
    target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    window.dispatchEvent(new MouseEvent("pointercancel"));
    expect(controls.press).toHaveBeenLastCalledWith(false);
    const calls = controls.press.mock.calls.length;
    for (const stop of stops.splice(0)) stop();
    target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    key("keydown", "Space");
    expect(controls.press).toHaveBeenCalledTimes(calls);
  });
});

describe("pausing", () => {
  it("is P, when it goes down, and not when it comes up", () => {
    const { controls } = setup();
    key("keydown", "KeyP");
    expect(controls.pause).toHaveBeenCalledTimes(1);
    key("keyup", "KeyP");
    expect(controls.pause).toHaveBeenCalledTimes(1);
    expect(controls.press).not.toHaveBeenCalled();
  });
});
