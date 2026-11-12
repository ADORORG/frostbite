import { byInput } from "@frostbite/game-sdk/touch";

import type { Hands } from "./controls.ts";
import { element } from "./elements.ts";

// The buttons under the screen, for a mouse and for a keyboard's Tab: Start (Go again after a run), Pause, Previous and Next to choose who
// leads, Act (held, it breathes in), Jump, Vision, End run (which sends the run as it stands) and Cards (the run's share cards). None of them
// ever leaves its place: a button not on offer is greyed out, and Start is only made invisible while a run goes, so nothing under the
// player's hand moves when a run starts. `ending` is the end of a run playing out (the family's farewell) before the card after it.
export type Phase = "choosing" | "ending" | "over" | "ready" | "running";

export interface Buttons {
  // Offers the share cards once there are some.
  readonly offerCards: (some: boolean) => void;
  readonly show: (phase: Phase) => void;
  readonly start: HTMLButtonElement;
}

export function attachButtons(hands: Hands): Buttons {
  const start = element("start", "button");
  const pause = element("pause", "button");
  const previous = element("previous", "button");
  const next = element("next", "button");
  const act = element("act", "button");
  const jump = element("jump", "button");
  const vision = element("vision", "button");
  const end = element("end", "button");
  const cards = element("cards", "button");
  cards.addEventListener("click", hands.cards);
  start.addEventListener("click", hands.start);
  end.addEventListener("click", hands.end);
  pause.addEventListener("click", hands.pause);
  previous.addEventListener("click", () => {
    hands.turn(-1);
  });
  next.addEventListener("click", () => {
    hands.turn(1);
  });
  vision.addEventListener("click", hands.vision);
  jump.addEventListener("click", hands.jump);
  act.addEventListener("pointerdown", () => {
    hands.act(true);
  });
  act.addEventListener("pointerup", () => {
    hands.act(false);
  });
  // A keyboard (or a screen reader) presses a focused button with a click no pointer began: a press and a release.
  act.addEventListener("click", (event) => {
    if (event.detail !== 0) return;
    hands.act(true);
    hands.act(false);
  });
  return {
    offerCards(some) {
      cards.disabled = !some;
    },
    show(phase) {
      const going = phase === "running";
      start.hidden = going;
      pause.disabled = !going;
      previous.disabled = going;
      next.disabled = going;
      act.disabled = !going;
      jump.disabled = !going;
      vision.disabled = !going;
      end.disabled = !going;
    },
    start,
  };
}

// The line under the screen for each phase: how to choose and begin, and, in a run, how to play.
export function noteFor(phase: Phase): string {
  if (phase === "over" || phase === "ending") return "";
  if (phase === "running")
    return byInput(
      "Arrows walk, Shift runs and Space jumps. E acts, and held it breathes in. Q opens vision. 1 to 8 practise.",
      "Drag to walk and further to run. Tap to act or sit, and hold to breathe in.",
    );
  return byInput(
    "Left and right choose who leads, and Enter starts.",
    "Swipe to choose who leads, and tap to start.",
  );
}
