import { aimOf } from "../rules/act.ts";
import { things } from "../rules/things.ts";
import type { News, PlayState } from "../rules/types.ts";
import { toastOf } from "../script/news.ts";
import {
  hillHint,
  promptFor,
  seatedWords,
  tugWords,
} from "../script/prompts.ts";
import { createSeating } from "../view/seats.ts";
import { element } from "./elements.ts";

// The two lines over the screen: what the act key would do where the lead stands ("E: open the fridge"; sat down, "E: stand up") or, by
// the giant snake asleep on the hill, what it waits for, or, when Sparky tugs, to follow him; and a toast when something happens
// (Sparky found, a skill mastered), which stays a few seconds and goes.
export interface Overlay {
  readonly show: (state: PlayState, now: number, tugging?: boolean) => void;
  readonly hear: (news: News, now: number) => void;
}

const thingIds = things.map((thing) => thing.id);
export const toastMs = 3_500;

export function createOverlay(actWord: () => string): Overlay {
  const prompt = element("prompt", "p");
  const toast = element("toast", "p");
  let until = 0;
  // Whether the lead sits, worked out as the view works it out (see seats.ts).
  const seating = createSeating();
  return {
    hear(news, now) {
      const line = toastOf(news);
      if (line === null) return;
      toast.textContent = line;
      until = now + toastMs;
    },
    show(state, now, tugging = false) {
      const aim = aimOf(state);
      const sat = seating.update(state, 0);
      prompt.textContent =
        aim === null
          ? (hillHint(state) ?? (tugging ? tugWords : ""))
          : `${actWord()}: ${sat === null ? promptFor(aim.target, state, thingIds) : seatedWords[sat.seat.kind]}`;
      if (now >= until) toast.textContent = "";
    },
  };
}
