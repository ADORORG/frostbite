import { attachKeys, standardKeys } from "@frostbite/game-sdk/controls";

import { chapterIds, type PlayId } from "../rules/constants.ts";

// What the player's hands can do, the same in every chapter: four ways to go, an action button, a fire button, the backpack's three foods
// (B a berry, R a mushroom, G a pineapple; M and N are the sound panel's), frost vision (V), Sparky's help (H), and the hotkeys of a cheer challenge, which out of the maze in the woods fly up (E) and down (Q) (1 to 5 for the shows, Q a quick cheer, E evade, C a charm); start (Enter) and pause (P, or the button). Each level
// says what they mean to it (`runs.ts`); between runs, 0 chooses the whole quest and 1, 2 and 3 a level to practise instead. The keys are the arrows and WASD; Space and Z
// are the action; F and X breathe fire. A touch screen has a button for each (any element with a `data-hold`).
export const actions = [
  "left",
  "right",
  "up",
  "down",
  "act",
  "fire",
  "hot0",
  "hot1",
  "hot2",
  "hot3",
  "hot4",
  "hot5",
  "quick",
  "evade",
  "charm",
  "berry",
  "mushroom",
  "pineapple",
  "vision",
  "help",
] as const;
export type Action = (typeof actions)[number];

// What a number key chooses between runs: 0 the whole quest, 1 to 3 a level to practise.
export function playOfKey(action: Action): PlayId | undefined {
  if (action === "hot0") return "quest";
  return action === "hot1" || action === "hot2" || action === "hot3"
    ? chapterIds[Number(action.slice(3)) - 1]
    : undefined;
}

export interface Hands {
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
  Digit0: "hot0",
  Digit1: "hot1",
  Digit2: "hot2",
  Digit3: "hot3",
  Digit4: "hot4",
  Digit5: "hot5",
  KeyA: "left",
  KeyB: "berry",
  KeyC: "charm",
  KeyD: "right",
  KeyE: "evade",
  KeyF: "fire",
  KeyG: "pineapple",
  KeyH: "help",
  KeyQ: "quick",
  KeyR: "mushroom",
  KeyS: "down",
  KeyV: "vision",
  KeyW: "up",
  KeyX: "fire",
  KeyZ: "act",
  Numpad0: "hot0",
  Numpad1: "hot1",
  Numpad2: "hot2",
  Numpad3: "hot3",
  Numpad4: "hot4",
  Numpad5: "hot5",
  Space: "act",
} as const;

const actionNamed = (name: string | null | undefined): Action | undefined =>
  actions.find((action) => action === name);

// Keys on the page, and the touch buttons. A key or finger held when the page is left is let go of, since its release would never be
// seen. Returns a function that stops listening.
export function attachHands(root: HTMLElement, hands: Hands): () => void {
  const stopKeys = attachKeys(window, keys, (name, phase) => {
    if (name === "start" || name === "pause") {
      if (phase === "down") hands[name]();
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
