// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachControls,
  swipeDirection,
  swipeDistance,
} from "../src/screen/controls.ts";
import { ensureCells, showBoard } from "../src/screen/board-view.ts";

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
    const board = document.createElement("div");
    const choose = vi.fn();
    const start = vi.fn();
    const pause = vi.fn();
    stops.push(attachControls(board, { move: choose, pause, start }));
    return { board, choose, pause, start };
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
    board: HTMLElement,
    from: [number, number],
    to: [number, number],
  ) => {
    board.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: from[0], clientY: from[1] }),
    );
    board.dispatchEvent(
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

  it("moves on a swipe across the board, and not on a touch that hardly moved or that began elsewhere", () => {
    const { board, choose } = setup();
    drag(board, [10, 10], [90, 12]);
    expect(choose).toHaveBeenLastCalledWith("right");
    drag(board, [10, 10], [12, 12]);
    expect(choose).toHaveBeenCalledTimes(1);
    board.dispatchEvent(
      new MouseEvent("pointerup", { clientX: 90, clientY: 10 }),
    );
    expect(choose).toHaveBeenCalledTimes(1);
  });

  it("stops listening when told to", () => {
    const board = document.createElement("div");
    const choose = vi.fn();
    const stop = attachControls(board, {
      move: choose,
      pause: vi.fn(),
      start: vi.fn(),
    });
    stop();
    press("ArrowLeft");
    drag(board, [0, 0], [90, 0]);
    expect(choose).not.toHaveBeenCalled();
  });
});

describe("drawing the board", () => {
  it("makes a cell for each place, once, and then writes each tile's value and level", () => {
    const grid = document.createElement("div");
    const cells = ensureCells(grid);
    expect(cells).toHaveLength(16);
    expect(ensureCells(grid)[0]).toBe(cells[0]);
    showBoard(grid, [1, 2, 0, 11, ...Array.from({ length: 12 }, () => 0)]);
    const shown = [...grid.children] as HTMLElement[];
    expect(shown.map((cell) => cell.textContent).slice(0, 4)).toEqual([
      "2",
      "4",
      "",
      "2048",
    ]);
    expect(shown[3]?.dataset.level).toBe("11");
    expect(shown[2]?.dataset.level).toBe("0");
  });

  it("marks a tile that has just appeared, and one made by a join, for the page to animate; and nothing on a fresh run", () => {
    const grid = document.createElement("div");
    const before = [1, 1, 3, ...Array.from({ length: 13 }, () => 0)];
    const after = [2, 0, 3, 1, ...Array.from({ length: 12 }, () => 0)];
    showBoard(grid, after, before);
    const cell = (at: number) => grid.children[at] as HTMLElement;
    expect(cell(0).dataset).toMatchObject({ merged: "true", new: "false" });
    expect(cell(1).dataset).toMatchObject({ merged: "false", new: "false" });
    expect(cell(2).dataset).toMatchObject({ merged: "false", new: "false" });
    expect(cell(3).dataset).toMatchObject({ merged: "false", new: "true" });
    showBoard(grid, after);
    expect(
      [...grid.children].every(
        (c) =>
          (c as HTMLElement).dataset.new === "false" &&
          (c as HTMLElement).dataset.merged === "false",
      ),
    ).toBe(true);
  });

  it("describes the board for someone who cannot see it, and caps the colour at the biggest tile it has one for", () => {
    const grid = document.createElement("div");
    showBoard(grid, [1, 0, 14, ...Array.from({ length: 13 }, () => 0)]);
    expect(grid.getAttribute("aria-label")).toBe(
      `Board: 2, empty, ${2 ** 14}, ${Array(13).fill("empty").join(", ")}`,
    );
    expect((grid.children[2] as HTMLElement).dataset.level).toBe("12");
  });

  it("draws an empty page when there is no run", () => {
    const grid = document.createElement("div");
    showBoard(grid, []);
    expect([...grid.children].every((cell) => cell.textContent === "")).toBe(
      true,
    );
  });
});
