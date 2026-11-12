import {
  bestLine,
  resultWeight,
  type ResultCard,
} from "@frostbite/game-sdk/guide";

import type { StarterState } from "../rules/types.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

// The card after a run: how it ended, the score, the best, and how to go again. The SDK draws it over the screen at the pixels of the display,
// so it stays sharp when the small screen is scaled up.
export const resultOf = (state: StarterState, view: View): ResultCard | null =>
  view.phase === "over"
    ? {
        rows: [
          {
            colour: colour.danger,
            text: state.cause === "timeout" ? "TIME" : "MISSED",
            weight: resultWeight.heading,
          },
          {
            colour: colour.text,
            text: `CAUGHT ${String(state.score)}`,
            weight: resultWeight.detail,
          },
          {
            colour: colour.yellow,
            text: bestLine(view.best, view.newBest),
            weight: resultWeight.line,
          },
          {
            colour: colour.text,
            text: "ENTER, SPACE OR TAP TO GO AGAIN",
            weight: resultWeight.prompt,
          },
        ],
      }
    : null;
