import {
  bestLine,
  resultWeight,
  type ResultCard,
} from "@frostbite/game-sdk/guide";
import { byInput } from "@frostbite/game-sdk/touch";

import type { MazeState } from "../rules/state.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

const reasons = {
  dark: "THE LANTERN WENT OUT",
  escaped: "YOU ESCAPED THE CELLAR",
  spent: "YOUR LEGS GAVE OUT",
} as const;

// The card after a run: how it ended, the floors and the score, the best, and how to go again (a key for a keyboard, a tap for a finger). The
// SDK draws it over the screen at the pixels of the display, so it stays sharp when the small screen is scaled up.
export const resultOf = (state: MazeState, view: View): ResultCard | null =>
  view.phase === "over"
    ? {
        rows: [
          {
            colour: colour.danger,
            text: state.cause === null ? "RUN OVER" : reasons[state.cause],
            weight: resultWeight.heading,
          },
          {
            colour: colour.text,
            text: `FLOORS ${String(state.floorsCleared)}   SCORE ${String(state.score)}`,
            weight: resultWeight.detail,
          },
          {
            colour: colour.flameHot,
            text: bestLine(view.best, view.newBest),
            weight: resultWeight.line,
          },
          {
            colour: colour.cyan,
            text: byInput("ENTER FOR ANOTHER CELLAR", "TAP FOR ANOTHER CELLAR"),
            weight: resultWeight.prompt,
          },
        ],
      }
    : null;
