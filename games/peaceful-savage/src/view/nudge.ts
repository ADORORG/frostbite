import { ticksPerSecond } from "../rules/constants.ts";
import type { PlayState } from "../rules/types.ts";
import { gladNews } from "./acting.ts";
import { goalOf } from "./compass.ts";

// When the story stalls (a while with nothing found, healed, woven, learned or lit, and no moment under way), Sparky tugs the lead on
// toward where the story goes next, and his gold thread to it shows. The tug ends as soon as the story moves again or the lead gets
// there. It reads the state only, by its ticks, so a paused game does not count as stalled, and it changes nothing in the rules.
export const stallTicks = ticksPerSecond * 20;
const near = 2_500;

export interface Nudge {
  // Whether Sparky tugs now.
  update(state: PlayState): boolean;
}

export function createNudge(): Nudge {
  let since = -1;
  let heard = -1;
  return {
    update(state) {
      const news = state.news;
      if (news !== null && news.tick !== heard) {
        heard = news.tick;
        if (gladNews.includes(news.kind)) since = state.tick;
      }
      if (
        since < 0 ||
        state.tick < since ||
        state.moment !== null ||
        !state.sparky
      )
        since = state.tick;
      if (state.tick - since < stallTicks) return false;
      const goal = goalOf(state);
      return (
        goal !== null && Math.hypot(goal.x - state.x, goal.z - state.z) > near
      );
    },
  };
}
