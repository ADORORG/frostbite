import {
  bestLine,
  resultWeight,
  type ResultCard,
} from "@frostbite/game-sdk/guide";

import { levelOf } from "../rules/difficulty.ts";
import type { PermafrostState } from "../rules/types.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

// The card after a run: how it ended, the score, the rows and level reached, the best, and how to go again. The SDK draws it over the screen
// at the pixels of the display, so it stays sharp when the small screen is scaled up.
export const resultOf = (
  state: PermafrostState,
  view: View,
): ResultCard | null =>
  view.phase === "over"
    ? {
        rows: [
          {
            colour: colour.danger,
            text: state.blocked ? "FROZEN OVER" : "TIME",
            weight: resultWeight.heading,
          },
          {
            colour: colour.text,
            text: `SCORE ${String(state.score)}`,
            weight: resultWeight.detail,
          },
          {
            colour: colour.text,
            text: `${String(state.lines)} ROWS, LEVEL ${String(levelOf(state.lines))}`,
            weight: resultWeight.line,
          },
          {
            colour: colour.yellow,
            text: bestLine(view.best, view.newBest),
            weight: resultWeight.line,
          },
          {
            colour: colour.text,
            text: "ENTER OR TAP TO GO AGAIN",
            weight: resultWeight.prompt,
          },
        ],
      }
    : null;
