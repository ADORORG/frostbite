// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachControls } from "../src/screen/controls.ts";

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  const setup = () => {
    const target = document.createElement("div");
    document.body.append(target);
    const catchIt = vi.fn();
    const pause = vi.fn();
    const start = vi.fn();
    stops.push(attachControls(target, { catchIt, pause, start }));
    return { catchIt, pause, start, target };
  };
  const press = (code: string, repeat = false) => {
    const event = new KeyboardEvent("keydown", {
      cancelable: true,
      code,
      repeat,
    });
    window.dispatchEvent(event);
    return event;
  };

  it.each(["Space", "ArrowDown"])(
    "catches on %s, and the page does not scroll",
    (code) => {
      const { catchIt } = setup();
      expect(press(code).defaultPrevented).toBe(true);
      expect(catchIt).toHaveBeenCalledTimes(1);
    },
  );

  it("starts on Enter and pauses on P, and neither catches", () => {
    const { catchIt, pause, start } = setup();
    expect(press("Enter").defaultPrevented).toBe(true);
    press("NumpadEnter");
    press("KeyP");
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    expect(start).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(catchIt).not.toHaveBeenCalled();
  });

  it("ignores a held key, and a key that is not for the game", () => {
    const { catchIt } = setup();
    press("Space", true);
    expect(press("KeyQ").defaultPrevented).toBe(false);
    expect(catchIt).not.toHaveBeenCalled();
  });

  it("catches on a touch or a click anywhere on the screen", () => {
    const { catchIt, target } = setup();
    target.dispatchEvent(
      new Event("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(catchIt).toHaveBeenCalledTimes(1);
  });

  it("stops listening when it is told to", () => {
    const { catchIt, target } = setup();
    for (const stop of stops.splice(0)) stop();
    press("Space");
    target.dispatchEvent(new Event("pointerdown"));
    expect(catchIt).not.toHaveBeenCalled();
  });
});
