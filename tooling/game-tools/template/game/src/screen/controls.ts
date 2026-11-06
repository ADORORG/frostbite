import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";

// What the player's hands can do: catch the marker, and the keys every game shares (Enter starts, P pauses). Space catches here, since the
// catch is what the hand is on; Enter catches too once a run is going, which the page decides.
export interface Controls {
  readonly catchIt: () => void;
  readonly pause: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "catchIt",
  Space: "catchIt",
} as const;

// Keys on the page, and touches on the screen. Returns a function that stops listening.
export function attachControls(
  target: HTMLElement,
  controls: Controls,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase === "down") controls[action]();
  });
  const onPointer = (event: PointerEvent): void => {
    controls.catchIt();
    event.preventDefault();
  };
  target.addEventListener("pointerdown", onPointer);
  return () => {
    stopKeys();
    target.removeEventListener("pointerdown", onPointer);
  };
}
