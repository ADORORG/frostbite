import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";
import { attachZones } from "@frostbite/game-sdk/touch-zones";

import { laneAt, screenWidth } from "./layout.ts";

// What the player's hands can do. Four keys are the four lanes (D F J K, or the arrow keys), a touch is a tap on the lane it lands on (the margins belong to the lane beside them),
// Enter starts a run, and P or Space pauses. Pressed with no run going, a lane does nothing (only Enter and the button start one).
export interface Controls {
  // A lane (0 to 3) is tapped.
  readonly lane: (lane: number) => void;
  readonly pause: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "lane1",
  ArrowLeft: "lane0",
  ArrowRight: "lane3",
  ArrowUp: "lane2",
  KeyD: "lane0",
  KeyF: "lane1",
  KeyJ: "lane2",
  KeyK: "lane3",
  Space: "pause",
} as const;

// The lane under a touch at a part of the screen's width (0 to 1).
export const laneOfTouch = (fraction: number): number =>
  laneAt(fraction * screenWidth);

export function attachControls(
  screen: HTMLElement,
  controls: Controls,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase !== "down") return;
    if (action === "start" || action === "pause") controls[action]();
    else controls.lane(Number(action.slice(4)));
  });
  const stopTouch = attachZones(screen, {
    enter: controls.lane,
    fingersOnly: false,
    leave: () => undefined,
    slide: false,
    zoneAt: ({ x }) => laneOfTouch(x),
  });
  return () => {
    stopKeys();
    stopTouch();
  };
}
