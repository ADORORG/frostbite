import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";

// What the player's hands can do: drop the block, and the keys every game shares (Enter starts, P pauses). Space drops here, since the
// drop is what the hand is on; Enter drops too once a run is going, which the page decides.
export interface Controls {
  readonly drop: () => void;
  readonly pause: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "drop",
  KeyS: "drop",
  Space: "drop",
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
    controls.drop();
    event.preventDefault();
  };
  target.addEventListener("pointerdown", onPointer);
  return () => {
    stopKeys();
    target.removeEventListener("pointerdown", onPointer);
  };
}
