// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachControls,
  restRadius,
  stepRepeatMs,
  steerDirection,
} from "../src/screen/controls.ts";
import { screenHeight, screenWidth } from "../src/screen/layout.ts";

const lantern = { x: 80, y: 45 };

describe("steering", () => {
  it("is the way from the lantern to the finger along the longer side, and nothing on the lantern itself", () => {
    expect(steerDirection(lantern, { x: 120, y: 50 })).toBe("right");
    expect(steerDirection(lantern, { x: 40, y: 50 })).toBe("left");
    expect(steerDirection(lantern, { x: 82, y: 80 })).toBe("down");
    expect(steerDirection(lantern, { x: 82, y: 5 })).toBe("up");
    expect(steerDirection(lantern, { x: 90, y: 55 })).toBe("right");
    expect(
      steerDirection(lantern, { x: 80 + restRadius - 0.1, y: 45 }),
    ).toBeNull();
    expect(steerDirection(lantern, { x: 80 + restRadius, y: 45 })).toBe(
      "right",
    );
    expect(
      steerDirection(lantern, { x: 80, y: 45 - restRadius + 0.1 }),
    ).toBeNull();
  });
});

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    vi.useRealTimers();
  });
  // A screen shown at the size it is drawn, so a screen pixel is a page pixel.
  const setup = (at: typeof lantern | null = lantern) => {
    const screen = document.createElement("div");
    screen.getBoundingClientRect = () =>
      ({
        height: screenHeight,
        left: 0,
        top: 0,
        width: screenWidth,
      }) as DOMRect;
    const choose = vi.fn();
    const start = vi.fn();
    const pause = vi.fn();
    stops.push(
      attachControls(screen, { move: choose, pause, start }, () => at),
    );
    return { screen, choose, pause, start };
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
  const touch = (
    target: EventTarget,
    type: string,
    at: { x: number; y: number },
    id = 1,
  ) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: at.x,
      clientY: at.y,
    });
    Object.assign(event, { pointerId: id, pointerType: "touch" });
    target.dispatchEvent(event);
  };

  it("moves on the arrow keys and on WASD, and takes over only those keys", () => {
    const { choose } = setup();
    const pairs = [
      ["ArrowLeft", "left"],
      ["KeyA", "left"],
      ["ArrowRight", "right"],
      ["KeyD", "right"],
      ["ArrowUp", "up"],
      ["KeyW", "up"],
      ["ArrowDown", "down"],
      ["KeyS", "down"],
    ] as const;
    for (const [code, direction] of pairs) {
      expect(press(code).defaultPrevented).toBe(true);
      expect(choose).toHaveBeenLastCalledWith(direction);
    }
    expect(choose).toHaveBeenCalledTimes(pairs.length);
    expect(press("KeyQ").defaultPrevented).toBe(false);
    press("ArrowLeft", true);
    expect(choose).toHaveBeenCalledTimes(pairs.length);
  });

  it("starts on Enter and pauses on P and on Space, on the press and not the release", () => {
    const { choose, pause, start } = setup();
    press("Enter");
    press("NumpadEnter");
    press("KeyP");
    press("Space");
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));
    expect(start).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(2);
    expect(choose).not.toHaveBeenCalled();
  });

  it("steps toward a tap at once, and walks on while the finger stays down", () => {
    vi.useFakeTimers();
    const { screen, choose } = setup();
    touch(screen, "pointerdown", { x: 140, y: 45 });
    expect(choose.mock.calls).toEqual([["right"]]);
    vi.advanceTimersByTime(stepRepeatMs * 3);
    expect(choose).toHaveBeenCalledTimes(4);
    touch(window, "pointerup", { x: 140, y: 45 });
    vi.advanceTimersByTime(stepRepeatMs * 3);
    expect(choose).toHaveBeenCalledTimes(4);
  });

  it("turns as the finger moves round the lantern, and stops when it comes back onto it", () => {
    vi.useFakeTimers();
    const { screen, choose } = setup();
    touch(screen, "pointerdown", { x: 140, y: 45 });
    touch(window, "pointermove", { x: 80, y: 10 });
    expect(choose).toHaveBeenLastCalledWith("up");
    vi.advanceTimersByTime(stepRepeatMs);
    expect(choose).toHaveBeenLastCalledWith("up");
    const before = choose.mock.calls.length;
    touch(window, "pointermove", { x: 81, y: 45 });
    vi.advanceTimersByTime(stepRepeatMs * 3);
    expect(choose).toHaveBeenCalledTimes(before);
  });

  it("lets one finger go without stopping the walk another is steering", () => {
    vi.useFakeTimers();
    const { screen, choose } = setup();
    touch(screen, "pointerdown", { x: 140, y: 45 }, 1);
    touch(screen, "pointerdown", { x: 80, y: 5 }, 2);
    touch(window, "pointerup", { x: 140, y: 45 }, 1);
    choose.mockClear();
    vi.advanceTimersByTime(stepRepeatMs);
    expect(choose.mock.calls).toEqual([["up"]]);
  });

  it("does nothing for a finger when there is no run, or one that began on the lantern", () => {
    vi.useFakeTimers();
    const idle = setup(null);
    touch(idle.screen, "pointerdown", { x: 140, y: 45 });
    vi.advanceTimersByTime(stepRepeatMs * 2);
    expect(idle.choose).not.toHaveBeenCalled();
    const on = setup();
    touch(on.screen, "pointerdown", { x: 80, y: 45 });
    vi.advanceTimersByTime(stepRepeatMs * 2);
    expect(on.choose).not.toHaveBeenCalled();
  });

  it("stops listening and walking when told to", () => {
    vi.useFakeTimers();
    const screen = document.createElement("div");
    screen.getBoundingClientRect = () =>
      ({ height: 90, left: 0, top: 0, width: 160 }) as DOMRect;
    const choose = vi.fn();
    const stop = attachControls(
      screen,
      { move: choose, pause: vi.fn(), start: vi.fn() },
      () => lantern,
    );
    touch(screen, "pointerdown", { x: 140, y: 45 });
    expect(choose).toHaveBeenCalledTimes(1);
    stop();
    vi.advanceTimersByTime(stepRepeatMs * 3);
    press("ArrowLeft");
    touch(screen, "pointerdown", { x: 140, y: 45 });
    expect(choose).toHaveBeenCalledTimes(1);
  });
});
