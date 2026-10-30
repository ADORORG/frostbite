import { attachKeys, standardKeys } from "@ador/game-sdk/controls";

import type { Direction } from "../rules/constants.ts";

// What the player's hands can do: step the lantern, start a run (Enter) and pause (P or Space, since Space has no other use here).
export interface Controls {
  readonly move: (direction: Direction) => void;
  readonly pause: () => void;
  readonly start: () => void;
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
  Space: "pause",
} as const;

// The shortest drag that is a swipe, in pixels.
export const swipeDistance = 24;

// The direction of a drag, or null for one too short to mean anything.
export function swipeDirection(dx: number, dy: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeDistance) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

// Arrow keys and WASD on the page, and swipes on the screen. Returns a function that stops listening.
export function attachControls(
  screen: HTMLElement,
  controls: Controls,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase !== "down") return;
    if (action === "start" || action === "pause") controls[action]();
    else controls.move(action);
  });
  let from: { x: number; y: number } | null = null;
  const onDown = (event: PointerEvent): void => {
    from = { x: event.clientX, y: event.clientY };
  };
  const onUp = (event: PointerEvent): void => {
    if (from === null) return;
    const direction = swipeDirection(
      event.clientX - from.x,
      event.clientY - from.y,
    );
    from = null;
    if (direction !== null) controls.move(direction);
  };
  screen.addEventListener("pointerdown", onDown);
  screen.addEventListener("pointerup", onUp);
  return () => {
    stopKeys();
    screen.removeEventListener("pointerdown", onDown);
    screen.removeEventListener("pointerup", onUp);
  };
}
