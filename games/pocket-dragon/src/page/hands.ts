import { attachKeys, standardKeys } from "@ador/game-sdk/controls";

import { chapterIds, type ChapterId } from "../rules/constants.ts";

// What the player's hands can do, the same in every chapter: four ways to go, an action button and a fire button, start (Enter), pause
// (P, or the button) and pick a chapter (1, 2 or 3). Each chapter says what the six mean to it (`runs.ts`). The keys are the arrows and
// WASD; Space, E and Z are the action; F and X breathe fire. A touch screen has a button for each (any element with a `data-hold`).
export const actions = ["left", "right", "up", "down", "act", "fire"] as const;
export type Action = (typeof actions)[number];

export interface Hands {
  readonly choose: (chapter: ChapterId) => void;
  readonly hold: (action: Action, on: boolean) => void;
  readonly pause: () => void;
  readonly start: () => void;
}

const keys = {
  ...standardKeys,
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  Digit1: "hills",
  Digit2: "woods",
  Digit3: "castle",
  KeyA: "left",
  KeyD: "right",
  KeyE: "act",
  KeyF: "fire",
  KeyS: "down",
  KeyW: "up",
  KeyX: "fire",
  KeyZ: "act",
  Numpad1: "hills",
  Numpad2: "woods",
  Numpad3: "castle",
  Space: "act",
} as const;

const actionNamed = (name: string | null | undefined): Action | undefined =>
  actions.find((action) => action === name);
const chapterNamed = (name: string): ChapterId | undefined =>
  chapterIds.find((chapter) => chapter === name);

// Keys on the page, and the touch buttons. A key or finger held when the page is left is let go of, since its release would never be
// seen. Returns a function that stops listening.
export function attachHands(root: HTMLElement, hands: Hands): () => void {
  const stopKeys = attachKeys(window, keys, (name, phase) => {
    if (name === "start" || name === "pause") {
      if (phase === "down") hands[name]();
      return;
    }
    const chapter = chapterNamed(name);
    if (chapter !== undefined) {
      if (phase === "down") hands.choose(chapter);
      return;
    }
    const action = actionNamed(name);
    if (action !== undefined) hands.hold(action, phase === "down");
  });
  const touch =
    (on: boolean) =>
    (event: PointerEvent): void => {
      const target =
        event.target instanceof Element
          ? event.target.closest("[data-hold]")
          : null;
      const action = actionNamed(target?.getAttribute("data-hold"));
      if (action === undefined) return;
      event.preventDefault();
      hands.hold(action, on);
    };
  const press = touch(true);
  const release = touch(false);
  const letGo = (): void => {
    for (const action of actions) hands.hold(action, false);
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
