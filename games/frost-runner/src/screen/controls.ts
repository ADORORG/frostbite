import { attachKeys, standardKeys } from "@ador/game-sdk/controls";

// What the player's hands can do: one key or touch for each of the two actions, Enter to start and P to pause (the same in every game).
export interface Controls {
  readonly jump: () => void;
  readonly pause: () => void;
  readonly slide: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "slide",
  ArrowUp: "jump",
  KeyS: "slide",
  KeyW: "jump",
  ShiftLeft: "slide",
  ShiftRight: "slide",
  Space: "jump",
} as const;

// Keys on the page, and touches on the screen: the top half jumps and the bottom half slides. Returns a function that stops listening.
export function attachControls(
  target: HTMLElement,
  controls: Controls,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (phase === "down") controls[action]();
  });
  const onPointer = (event: PointerEvent): void => {
    const box = target.getBoundingClientRect();
    if (event.clientY - box.top < box.height / 2) controls.jump();
    else controls.slide();
    event.preventDefault();
  };
  target.addEventListener("pointerdown", onPointer);
  return () => {
    stopKeys();
    target.removeEventListener("pointerdown", onPointer);
  };
}
