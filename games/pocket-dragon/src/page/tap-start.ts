import { plays } from "./zones.ts";

// A tap on the screen starts a run when none is going, as Enter and the Start button do. A tap is a finger that comes down and lifts again
// soon and close by, both while a run may start; one that came down during a run, or within a moment of the last touch of one, does not
// count, so a thumb still busy when a run ends does not start the next before the player has seen how it went. A stand-in for the SDK's
// `attachTapToStart` (`@ador/game-sdk/touch-start`) in the owners' newer `dev`: switch to it once it is on `dev`.
export const settleMs = 600;
export const tapMs = 800;
export const tapPx = 32;

export interface TapOptions {
  // No run is going and nothing is open over the page.
  readonly canStart: () => boolean;
  readonly now?: () => number;
  readonly start: () => void;
}

export function attachTapToStart(
  surface: HTMLElement,
  { canStart, now = () => performance.now(), start }: TapOptions,
): () => void {
  const taps = new Map<number, { at: number; x: number; y: number }>();
  let busyAt = Number.NEGATIVE_INFINITY;
  const down = (event: PointerEvent): void => {
    if (!plays(event)) return;
    const at = now();
    if (!canStart()) busyAt = at;
    else if (at - busyAt >= settleMs)
      taps.set(event.pointerId, { at, x: event.clientX, y: event.clientY });
  };
  const up = (event: PointerEvent): void => {
    const tap = taps.get(event.pointerId);
    taps.delete(event.pointerId);
    if (tap === undefined || !canStart()) return;
    const quick = now() - tap.at <= tapMs;
    const near =
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= tapPx;
    if (quick && near) start();
  };
  const cancel = (event: PointerEvent): void =>
    void taps.delete(event.pointerId);
  surface.addEventListener("pointerdown", down);
  surface.addEventListener("pointerup", up);
  surface.addEventListener("pointercancel", cancel);
  return () => {
    surface.removeEventListener("pointerdown", down);
    surface.removeEventListener("pointerup", up);
    surface.removeEventListener("pointercancel", cancel);
  };
}
