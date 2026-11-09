import { aimOf } from "../rules/act.ts";
import { things } from "../rules/things.ts";
import type { News, PlayState } from "../rules/types.ts";
import { toastOf } from "../script/news.ts";
import { promptFor } from "../script/prompts.ts";
import { element } from "./elements.ts";

// The two lines over the screen: what the act key would do where the lead stands ("E: open the fridge"), and a toast when something
// happens (Sparky found, a skill mastered), which stays a few seconds and goes.
export interface Overlay {
  readonly show: (state: PlayState, now: number) => void;
  readonly hear: (news: News, now: number) => void;
}

const thingIds = things.map((thing) => thing.id);
export const toastMs = 3_500;

export function createOverlay(actWord: () => string): Overlay {
  const prompt = element("prompt", "p");
  const toast = element("toast", "p");
  let until = 0;
  return {
    hear(news, now) {
      const line = toastOf(news);
      if (line === null) return;
      toast.textContent = line;
      until = now + toastMs;
    },
    show(state, now) {
      const aim = aimOf(state);
      prompt.textContent =
        aim === null
          ? ""
          : `${actWord()}: ${promptFor(aim.target, state, thingIds)}`;
      if (now >= until) toast.textContent = "";
    },
  };
}
