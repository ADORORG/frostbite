import { attachKeys, standardKeys } from "@ador/game-sdk/controls";

import { laneAt, screenWidth } from "./layout.ts";

// What the player's hands can do. Four keys are the four lanes (D F J K, or the arrow keys), a touch is a tap in the quarter of the page it lands in,
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

// The lane a touch at a point on a canvas shown `width` wide lands in.
export const laneOfTouch = (
  width: number,
  left: number,
  clientX: number,
): number => laneAt(((clientX - left) * screenWidth) / width);

export function attachControls(
  screen: HTMLElement,
  controls: Controls,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase !== "down") return;
    if (action === "start" || action === "pause") controls[action]();
    else controls.lane(Number(action.slice(4)));
  });
  const onDown = (event: PointerEvent): void => {
    const box = screen.getBoundingClientRect();
    controls.lane(laneOfTouch(box.width, box.left, event.clientX));
  };
  screen.addEventListener("pointerdown", onDown);
  return () => {
    stopKeys();
    screen.removeEventListener("pointerdown", onDown);
  };
}
