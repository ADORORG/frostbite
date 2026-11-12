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

export function attachTouch(
  screen: HTMLElement,
  main: HTMLElement,
  controls: Controls,
): () => void {
  const stopZones = attachZones<Zone>(screen, {
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
  const nothing = (): void => undefined;
  const stopButtons = attachTouchButtons(main, [
    { label: "Drop", press: controls.hard, release: nothing },
    {
      label: "Soft",
      press: () => controls.soft(true),
      release: () => controls.soft(false),
    },
    { label: "Hold", press: controls.hold, release: nothing },
    { label: "Turn", press: controls.turnLeft, release: nothing },
  ]);
  return () => {
    stopZones();
    stopButtons();
  };
}
