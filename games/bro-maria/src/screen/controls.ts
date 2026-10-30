import { attachKeys, standardKeys } from "@ador/game-sdk/controls";

import type { Controls } from "../rules/types.ts";

// What the player's hands can do: hold a way to run, hold jump, start (Enter) and pause (P, or the button). The keys are the arrows and WASD;
// Space and up jump. A touch screen has the three buttons.
export interface Hands {
  readonly hold: (control: keyof Controls, on: boolean) => void;
  readonly pause: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "jump",
  KeyA: "left",
  KeyD: "right",
  KeyW: "jump",
  Space: "jump",
} as const;

const controlNames = ["jump", "left", "right"] as const;

// Keys on the page, and the touch buttons (any element with a `data-hold` naming a control). A key or finger held when the page is left is
// let go of, since its release would never be seen. Returns a function that stops listening.
export function attachHands(root: HTMLElement, hands: Hands): () => void {
  const stopKeys = attachKeys(window, keys, (action, phase) => {
    if (action === "start" || action === "pause") {
      if (phase === "down") hands[action]();
    } else hands.hold(action, phase === "down");
  });
  const touch =
    (on: boolean) =>
    (event: PointerEvent): void => {
      const target =
        event.target instanceof Element
          ? event.target.closest("[data-hold]")
          : null;
      const control = controlNames.find(
        (name) => name === target?.getAttribute("data-hold"),
      );
      if (control === undefined) return;
      event.preventDefault();
      hands.hold(control, on);
    };
  const press = touch(true);
  const release = touch(false);
  const letGo = (): void => {
    for (const control of controlNames) hands.hold(control, false);
  };
  root.addEventListener("pointerdown", press);
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);
  root.addEventListener("pointerleave", release, true);
  window.addEventListener("blur", letGo);
  return () => {
    stopKeys();
    root.removeEventListener("pointerdown", press);
    root.removeEventListener("pointerup", release);
    root.removeEventListener("pointercancel", release);
    root.removeEventListener("pointerleave", release, true);
    window.removeEventListener("blur", letGo);
  };
}
