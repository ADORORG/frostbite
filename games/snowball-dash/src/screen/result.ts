import type { ResultCard } from "@frostbite/game-sdk/guide";

import type { RunState } from "../rules/types.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

// The card after a run: how it ended, the score, the best, and how to go again. The SDK draws it over the screen at the pixels of the display, so
// it stays sharp when the small screen is scaled up.
export const resultOf = (state: RunState, view: View): ResultCard | null =>
  view.phase === "over"
    ? {
        rows: [
          {
            colour: colour.danger,
            text: state.cause === "fell" ? "INTO THE CREVASSE" : "RUN OVER",
            weight: 1.5,
          },
          {
            colour: colour.text,
            text: `SCORE ${String(state.score)}`,
            weight: 1.2,
          },
          {
            colour: colour.yellow,
            text: view.newBest ? "NEW BEST!" : `BEST ${String(view.best)}`,
            weight: 1,
          },
          {
            colour: colour.snowDark,
            text: "ENTER, SPACE OR TAP TO ROLL AGAIN",
            weight: 0.8,
          },
        ],
      }
    : null;
