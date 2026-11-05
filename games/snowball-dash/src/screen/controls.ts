import { attachKeys } from "@frostbite/game-sdk/controls";

// What the player's hands can do. One button does everything: Space, the up arrow, Enter or a touch on the screen. Pressed when no run is
// going, it starts one (and that press does not hop, so a run never begins with a leap); during a run it is the hop, and how long it is held
// is how high the snowball goes. P pauses, the same in every game. Space is the main action here, so it never pauses.
export interface Controls {
  readonly pause: () => void;
  // The button goes down (`true`) or comes up (`false`).
  readonly press: (down: boolean) => void;
}

const keys = {
  ArrowUp: "press",
  Enter: "press",
  KeyP: "pause",
  NumpadEnter: "press",
  Space: "press",
} as const;

// Keys on the page, and touches on the screen. Returns a function that stops listening.
export function attachControls(
  target: HTMLElement,
  controls: Controls,
): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (action === "pause") {
      if (phase === "down") controls.pause();
    } else controls.press(phase === "down");
  });
  const down = (event: PointerEvent): void => {
    controls.press(true);
    event.preventDefault();
  };
  const up = (): void => controls.press(false);
  target.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  return () => {
    stopKeys();
    target.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
}
