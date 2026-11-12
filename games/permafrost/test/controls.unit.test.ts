// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachControls } from "../src/screen/controls.ts";

describe("the player's hands on a keyboard", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  const setup = () => {
    const controls = {
      hard: vi.fn(),
      hold: vi.fn(),
      left: vi.fn(),
      pause: vi.fn(),
      right: vi.fn(),
      soft: vi.fn(),
      start: vi.fn(),
      turnLeft: vi.fn(),
      turnRight: vi.fn(),
    };
    stops.push(attachControls(controls));
    return controls;
  };
  const key = (type: "keydown" | "keyup", code: string, repeat = false) => {
    const event = new KeyboardEvent(type, { cancelable: true, code, repeat });
    window.dispatchEvent(event);
    return event;
  };

  it.each([
    ["ArrowUp", "turnRight"],
    ["KeyX", "turnRight"],
    ["KeyZ", "turnLeft"],
    ["Space", "hard"],
    ["KeyC", "hold"],
    ["ShiftLeft", "hold"],
    ["ShiftRight", "hold"],
    ["Enter", "start"],
    ["NumpadEnter", "start"],
    ["KeyP", "pause"],
  ] as const)(
    "does %s on a press, once, and the page does not scroll",
    (code, action) => {
      const controls = setup();
      expect(key("keydown", code).defaultPrevented).toBe(true);
      expect(controls[action]).toHaveBeenCalledTimes(1);
      key("keyup", code);
      expect(controls[action]).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["ArrowLeft", "left"],
    ["ArrowRight", "right"],
    ["ArrowDown", "soft"],
  ] as const)("holds %s down until it comes up", (code, action) => {
    const controls = setup();
    key("keydown", code);
    expect(controls[action]).toHaveBeenLastCalledWith(true);
    key("keyup", code);
    expect(controls[action]).toHaveBeenLastCalledWith(false);
    expect(controls[action]).toHaveBeenCalledTimes(2);
  });

  it("does not turn on a key that is only held, and ignores keys that are not for the game", () => {
    const controls = setup();
    key("keydown", "ArrowUp", true);
    key("keydown", "Space", true);
    expect(controls.turnRight).not.toHaveBeenCalled();
    expect(controls.hard).not.toHaveBeenCalled();
    expect(key("keydown", "KeyQ").defaultPrevented).toBe(false);
  });

  it("stops listening when it is told to", () => {
    const controls = setup();
    for (const stop of stops.splice(0)) stop();
    key("keydown", "Space");
    key("keydown", "ArrowLeft");
    expect(controls.hard).not.toHaveBeenCalled();
    expect(controls.left).not.toHaveBeenCalled();
  });
});
