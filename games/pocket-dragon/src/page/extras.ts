import { attachTouchButtons } from "@frostbite/game-sdk/touch-buttons";

import type { Action } from "./hands.ts";
import type { Shown } from "./runs.ts";

// The few buttons a place needs beyond the thumbs and the Bag, drawn by the SDK in the bottom right corner of a touch screen (and not shown
// to a mouse, which has the keys), only while a run is in that place: out of the woods' maze, flying up and down, frost vision and Sparky;
// in the Sky Nursery, the paint's colour and a clean sky. Each is held as its key is: E, Q, V and H outside the maze, E and C in the sky.
export type Extras = "nursery" | "outside";

const buttons: Readonly<
  Record<Extras, readonly (readonly [string, Action])[]>
> = {
  nursery: [
    ["Ink", "evade"],
    ["Clear", "charm"],
  ],
  outside: [
    ["Fly up", "evade"],
    ["Fly down", "quick"],
    ["Vision", "vision"],
    ["Sparky", "help"],
  ],
};

export const extrasFor = (shown: Shown, outside: boolean): Extras | null =>
  shown === "nursery"
    ? "nursery"
    : shown === "woods" && outside
      ? "outside"
      : null;

export function createExtras(
  main: HTMLElement,
  hold: (action: Action, on: boolean) => void,
) {
  let current: Extras | null = null;
  let detach = (): void => undefined;
  return {
    // The buttons of a place, or none; asking for the ones already shown changes nothing (a button being held stays held).
    show(next: Extras | null): void {
      if (next === current) return;
      detach();
      detach = () => undefined;
      current = next;
      if (next === null) return;
      detach = attachTouchButtons(
        main,
        buttons[next].map(([label, action]) => ({
          label,
          press: () => hold(action, true),
          release: () => hold(action, false),
        })),
      );
    },
  };
}
