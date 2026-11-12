import {
  bestLine,
  resultWeight,
  type ResultCard,
} from "@frostbite/game-sdk/guide";
import { byInput } from "@frostbite/game-sdk/touch";

import { heroIds } from "../rules/constants.ts";
import { family } from "../rules/state.ts";
import type { PlayState } from "../rules/types.ts";

// The card after a run: whether the tree was lit, the score, how far the family came, the best, and how to go again. The SDK draws it
// over the screen at the pixels of the display, so it stays sharp.
const colours = {
  gold: "#ffd23f",
  line: "#ece8ff",
  mint: "#5bead0",
} as const;

export function resultOf(
  state: PlayState,
  best: number,
  newBest: boolean,
): ResultCard {
  const together = state.lead === null ? 0 : family(state).length;
  const grey = state.cause === "grey";
  return {
    rows: [
      {
        colour: grey ? colours.line : colours.gold,
        text: grey
          ? "GONE GREY, FOR NOW"
          : state.cause === "lit"
            ? "THE TREE IS LIT!"
            : "THE RUN IS OVER",
        weight: resultWeight.heading,
      },
      {
        colour: colours.line,
        text: `SCORE ${String(state.score)}`,
        weight: resultWeight.detail,
      },
      {
        colour: colours.mint,
        text: grey
          ? "A TRUE WORD BRINGS THE COLOUR BACK"
          : `FAMILY ${String(together)} OF ${String(heroIds.length)}  THREADS ${String(state.threads)} OF 6`,
        weight: resultWeight.line,
      },
      {
        colour: colours.gold,
        text: bestLine(best, newBest),
        weight: resultWeight.line,
      },
      {
        colour: colours.line,
        text: byInput("ENTER TO GO AGAIN", "TAP TO GO AGAIN"),
        weight: resultWeight.prompt,
      },
    ],
  };
}
