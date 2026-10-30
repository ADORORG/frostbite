// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachControls,
  swipeDirection,
  swipeDistance,
} from "../src/screen/controls.ts";

describe("a swipe", () => {
  it("is the way the finger went furthest, and nothing when it hardly moved", () => {
    expect(swipeDirection(60, 10)).toBe("right");
    expect(swipeDirection(-60, 10)).toBe("left");
    expect(swipeDirection(10, 60)).toBe("down");
    expect(swipeDirection(10, -60)).toBe("up");
    expect(swipeDirection(swipeDistance - 1, 0)).toBeNull();
    expect(swipeDirection(0, -(swipeDistance - 1))).toBeNull();
    expect(swipeDirection(swipeDistance, 0)).toBe("right");
    expect(swipeDirection(30, 30)).toBe("right");
  });
});

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  const setup = () => {
    const screen = document.createElement("div");
    const choose = vi.fn();
    const start = vi.fn();
    const pause = vi.fn();
    stops.push(attachControls(screen, { move: choose, pause, start }));
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
  const drag = (
    screen: HTMLElement,
    from: [number, number],
    to: [number, number],
  ) => {
    screen.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: from[0], clientY: from[1] }),
    );
    screen.dispatchEvent(
      new MouseEvent("pointerup", { clientX: to[0], clientY: to[1] }),
    );
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

  it("moves on a swipe across the screen, and not on a touch that hardly moved or that began elsewhere", () => {
    const { screen, choose } = setup();
    drag(screen, [10, 10], [90, 12]);
    expect(choose).toHaveBeenLastCalledWith("right");
    drag(screen, [10, 10], [12, 12]);
    expect(choose).toHaveBeenCalledTimes(1);
    screen.dispatchEvent(
      new MouseEvent("pointerup", { clientX: 90, clientY: 10 }),
    );
    expect(choose).toHaveBeenCalledTimes(1);
  });

  it("stops listening when told to", () => {
    const screen = document.createElement("div");
    const choose = vi.fn();
    const stop = attachControls(screen, {
      move: choose,
      pause: vi.fn(),
      start: vi.fn(),
    });
    stop();
    press("ArrowLeft");
    drag(screen, [0, 0], [90, 0]);
    expect(choose).not.toHaveBeenCalled();
  });
});
