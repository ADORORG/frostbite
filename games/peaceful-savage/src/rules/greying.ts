import { sparkDim } from "./growth.ts";
import { withNews } from "./state.ts";
import type { PlayState } from "./types.ts";

// Poor choices have a cost. A trick believed while the lead's spark is already low greys the lead a step; at three steps the lead has
// gone grey, and the sly snakes take them into their coil: the run ends there, and the next one starts in colour. Every true answer and
// every whole breath brings a step of colour back, and a look in a mirror all of it, so a lead who listens and breathes never goes all
// the way grey.
export const greyLimit = 3;

export function believed(state: PlayState): PlayState {
  if (state.spark >= sparkDim) return state;
  const greyed = state.greyed + 1;
  if (greyed < greyLimit)
    return withNews({ ...state, greyed }, "greying", String(greyed));
  return withNews(
    {
      ...state,
      cause: "grey",
      ended: true,
      greyed,
      moment: null,
      moving: -1,
    },
    "joined",
  );
}

// A step of colour back (or all of it).
export const heartened = (state: PlayState, steps = 1): PlayState =>
  state.greyed === 0
    ? state
    : { ...state, greyed: Math.max(0, state.greyed - steps) };
