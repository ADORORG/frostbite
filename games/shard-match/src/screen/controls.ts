import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";

import { type Direction } from "../rules/constants.ts";
import { neighbour } from "../rules/board.ts";
import { cellAt, sizeOf, type Shape } from "./layout.ts";

// What the player's hands can do. The arrows or WASD move a cursor over the board; Space picks up the shard under it, and an arrow then swaps
// it that way; a tap picks a shard up and a tap on its neighbour swaps them; a drag from a shard to its neighbour swaps them. Enter starts a run
// and P pauses. Space is a main action here, so it never pauses.
export interface Controls {
  // Picks up (or puts down) the shard under the cursor.
  readonly grab: () => void;
  readonly move: (direction: Direction) => void;
  readonly pause: () => void;
  readonly start: () => void;
  // Swaps the shard in `cell` with its neighbour in `direction` (an index into the four directions).
  readonly swap: (cell: number, direction: number) => void;
  // A tap on the board cell `cell`.
  readonly tap: (cell: number) => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  KeyA: "left",
  KeyD: "right",
  KeyS: "down",
  KeyW: "up",
  Space: "grab",
} as const;

// The board cell under a pointer, on a canvas drawn `rect` wide on the page, or -1.
export function cellUnder(
  rect: {
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly width: number;
  },
  clientX: number,
  clientY: number,
  shape: Shape = "wide",
): number {
  const { height, width } = sizeOf(shape);
  return cellAt(
    ((clientX - rect.left) * width) / rect.width,
    ((clientY - rect.top) * height) / rect.height,
  );
}

// The direction from one cell to a neighbouring cell, or -1 when they are not neighbours.
export function directionBetween(from: number, to: number): number {
  return (
    [0, 1, 2, 3].find((direction) => neighbour(from, direction) === to) ?? -1
  );
}

// Keys on the page, and touches on the screen. Returns a function that stops listening.
export function attachControls(
  screen: HTMLElement,
  controls: Controls,
  shape: () => Shape = () => "wide",
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase !== "down") return;
    if (action === "start" || action === "pause" || action === "grab")
      controls[action]();
    else controls.move(action);
  });
  let from = -1;
  const onDown = (event: PointerEvent): void => {
    from = cellUnder(
      screen.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      shape(),
    );
  };
  const onUp = (event: PointerEvent): void => {
    const start = from;
    from = -1;
    if (start < 0) return;
    const end = cellUnder(
      screen.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      shape(),
    );
    const direction = directionBetween(start, end);
    if (end === start || end < 0) controls.tap(start);
    else if (direction >= 0) controls.swap(start, direction);
  };
  screen.addEventListener("pointerdown", onDown);
  screen.addEventListener("pointerup", onUp);
  return () => {
    stopKeys();
    screen.removeEventListener("pointerdown", onDown);
    screen.removeEventListener("pointerup", onUp);
  };
}
