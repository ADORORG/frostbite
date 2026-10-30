import { attachKeys, standardKeys } from "@ador/game-sdk/controls";

// What the player's hands can do: Enter, Space, the up arrow or a touch hop (Enter starts a run when none is going), and P pauses (the
// same in every game). Space is the main action here, so it never pauses.
export interface Controls {
  readonly hop: () => void;
  readonly pause: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowUp: "hop",
  Space: "hop",
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
    controls.hop();
    event.preventDefault();
  };
  target.addEventListener("pointerdown", onPointer);
  return () => {
    stopKeys();
    target.removeEventListener("pointerdown", onPointer);
  };
}
