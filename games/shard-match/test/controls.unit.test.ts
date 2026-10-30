// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachControls,
  cellUnder,
  directionBetween,
} from "../src/screen/controls.ts";
import { boardX, boardY, cell } from "../src/screen/layout.ts";

describe("a pointer on the screen", () => {
  const rect = { height: 360, left: 100, top: 50, width: 640 };
  it("is turned into the board cell under it, through the size the screen is shown at", () => {
    expect(cellUnder(rect, 100 + boardX * 4 + 2, 50 + boardY * 4 + 2)).toBe(0);
    expect(
      cellUnder(
        rect,
        100 + (boardX + 3 * cell) * 4 + 8,
        50 + (boardY + 2 * cell) * 4 + 8,
      ),
    ).toBe(19);
    expect(cellUnder(rect, 100, 50)).toBe(-1);
    expect(
      cellUnder(
        { ...rect, width: 320, height: 180 },
        100 + (boardX + cell) * 2 + 1,
        50 + boardY * 2 + 1,
      ),
    ).toBe(1);
  });

  it("is a swap direction between neighbours, and none between cells that are not", () => {
    expect([
      directionBetween(27, 19),
      directionBetween(27, 28),
      directionBetween(27, 35),
      directionBetween(27, 26),
    ]).toEqual([0, 1, 2, 3]);
    expect(directionBetween(27, 29)).toBe(-1);
    expect(directionBetween(7, 8)).toBe(-1);
    expect(directionBetween(27, 27)).toBe(-1);
  });
});

describe("the player's hands", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });
  const setup = () => {
    const screen = document.createElement("canvas");
    screen.getBoundingClientRect = () => ({
      bottom: 360,
      height: 360,
      left: 0,
      right: 640,
      toJSON: () => ({}),
      top: 0,
      width: 640,
      x: 0,
      y: 0,
    });
    const handlers = {
      grab: vi.fn(),
      move: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      swap: vi.fn(),
      tap: vi.fn(),
    };
    stops.push(attachControls(screen, handlers));
    return { handlers, screen };
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
  const at = (column: number, row: number): [number, number] => [
    (boardX + column * cell + 5) * 4,
    (boardY + row * cell + 5) * 4,
  ];
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

  it("moves the cursor on the arrow keys and WASD, and takes over only those keys", () => {
    const { handlers } = setup();
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
      expect(handlers.move).toHaveBeenLastCalledWith(direction);
    }
    expect(handlers.move).toHaveBeenCalledTimes(pairs.length);
    expect(press("KeyQ").defaultPrevented).toBe(false);
    press("ArrowLeft", true);
    expect(handlers.move).toHaveBeenCalledTimes(pairs.length);
  });

  it("starts on Enter, picks up on Space, and pauses on P (and Space does not pause)", () => {
    const { handlers } = setup();
    press("Enter");
    press("NumpadEnter");
    press("Space");
    press("KeyP");
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    expect(handlers.start).toHaveBeenCalledTimes(2);
    expect(handlers.grab).toHaveBeenCalledTimes(1);
    expect(handlers.pause).toHaveBeenCalledTimes(1);
  });

  it("swaps on a drag to a neighbour, taps on a touch that stays, and does nothing for a drag to a far cell or off the board", () => {
    const { handlers, screen } = setup();
    drag(screen, at(2, 3), at(3, 3));
    expect(handlers.swap).toHaveBeenLastCalledWith(26, 1);
    drag(screen, at(2, 3), at(2, 2));
    expect(handlers.swap).toHaveBeenLastCalledWith(26, 0);
    drag(screen, at(2, 3), at(2, 3));
    expect(handlers.tap).toHaveBeenLastCalledWith(26);
    drag(screen, at(2, 3), [at(2, 3)[0] + 2, at(2, 3)[1] + 1]);
    expect(handlers.tap).toHaveBeenCalledTimes(2);
    drag(screen, at(2, 3), at(5, 3));
    drag(screen, at(2, 3), [10_000, 10_000]);
    drag(screen, [1, 1], at(2, 3));
    expect(handlers.swap).toHaveBeenCalledTimes(2);
    expect(handlers.tap).toHaveBeenCalledTimes(3);
    screen.dispatchEvent(
      new MouseEvent("pointerup", { clientX: 90, clientY: 10 }),
    );
    expect(handlers.tap).toHaveBeenCalledTimes(3);
  });

  it("stops listening when told to", () => {
    const screen = document.createElement("canvas");
    const handlers = {
      grab: vi.fn(),
      move: vi.fn(),
      pause: vi.fn(),
      start: vi.fn(),
      swap: vi.fn(),
      tap: vi.fn(),
    };
    const stop = attachControls(screen, handlers);
    stop();
    press("ArrowLeft");
    drag(screen, [0, 0], [90, 0]);
    expect(handlers.move).not.toHaveBeenCalled();
  });
});
