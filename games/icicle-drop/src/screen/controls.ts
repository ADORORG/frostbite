import type { Direction } from "../rules/constants.ts";

const keys: Readonly<Record<string, Direction>> = {
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  KeyA: "left",
  KeyD: "right",
  KeyS: "down",
  KeyW: "up",
};

// The shortest drag that is a swipe, in pixels.
export const swipeDistance = 24;

// The direction of a drag, or null for one too short to mean anything.
export function swipeDirection(dx: number, dy: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeDistance) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

// Arrow keys and WASD on the page, and swipes on the board. Returns a function that stops listening.
export function attachControls(
  board: HTMLElement,
  choose: (direction: Direction) => void,
): () => void {
  const onKey = (event: KeyboardEvent): void => {
    const direction = keys[event.code];
    if (direction === undefined || event.repeat) return;
    event.preventDefault();
    choose(direction);
  };
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
    if (direction !== null) choose(direction);
  };
  window.addEventListener("keydown", onKey);
  board.addEventListener("pointerdown", onDown);
  board.addEventListener("pointerup", onUp);
  return () => {
    window.removeEventListener("keydown", onKey);
    board.removeEventListener("pointerdown", onDown);
    board.removeEventListener("pointerup", onUp);
  };
}
