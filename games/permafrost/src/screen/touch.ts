import { attachTouchButtons } from "@frostbite/game-sdk/touch-buttons";
import { attachZones, type Where } from "@frostbite/game-sdk/touch-zones";

import type { Controls } from "./controls.ts";

// The screen as the controller on a phone: a thumb on the left third slides the piece left for as long as it stays, one on the right third
// slides it right, and a tap in the middle turns it. Four buttons in the corner do the rest: drop, soft drop (held), hold and turn back.
export type Zone = "left" | "right" | "turn";

// The thirds of the screen's width.
const edge = 1 / 3;

export const zoneAt = (where: Where): Zone =>
  where.x < edge ? "left" : where.x > 1 - edge ? "right" : "turn";

// The thumb zones: listened to on the screen for as long as the run goes. Returns a function that stops listening and lets go of every
// zone held.
export function attachTouchZones(
  screen: HTMLElement,
  controls: Controls,
): () => void {
  return attachZones<Zone>(screen, {
    enter: (zone) => {
      if (zone === "turn") controls.turnRight();
      else controls[zone](true);
    },
    fingersOnly: true,
    leave: (zone) => {
      if (zone !== "turn") controls[zone](false);
    },
    slide: true,
    zoneAt,
  });
}

export interface CornerButtons {
  // Whether the buttons can be seen and pressed. They are always in the page, in the same place, so showing them moves nothing; a button that
  // cannot be seen is not counted among the things to press on the first screen.
  readonly show: (shown: boolean) => void;
  readonly stop: () => void;
}

const hiddenWhenResting = "hidden";

export function attachCornerButtons(
  main: HTMLElement,
  controls: Controls,
): CornerButtons {
  const nothing = (): void => undefined;
  const stop = attachTouchButtons(main, [
    { label: "Drop", press: controls.hard, release: nothing },
    {
      label: "Soft",
      press: () => controls.soft(true),
      release: () => controls.soft(false),
    },
    { label: "Hold", press: controls.hold, release: nothing },
    { label: "Turn", press: controls.turnLeft, release: nothing },
  ]);
  const cluster = main.querySelector<HTMLElement>(".touch-buttons");
  if (cluster !== null) cluster.style.visibility = hiddenWhenResting;
  return {
    show(shown) {
      if (cluster !== null)
        cluster.style.visibility = shown ? "visible" : hiddenWhenResting;
    },
    stop,
  };
}
