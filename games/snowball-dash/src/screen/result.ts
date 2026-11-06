import {
  bestLine,
  type Card,
  resultWeight,
  type ResultCard,
} from "@frostbite/game-sdk/guide";

import type { RunState } from "../rules/types.ts";
import { guide } from "../guide.ts";
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
            weight: resultWeight.heading,
          },
          {
            colour: colour.text,
            text: `SCORE ${String(state.score)}`,
            weight: resultWeight.detail,
          },
          {
            colour: colour.yellow,
            text: bestLine(view.best, view.newBest),
            weight: resultWeight.line,
          },
          {
            colour: colour.snowDark,
            text: "ENTER, SPACE OR TAP TO ROLL AGAIN",
            weight: resultWeight.prompt,
          },
        ],
      }
    : null;

// What is over the screen: the first-screen card while the game waits to begin, the card after a run once it is over, and nothing while a run goes.
export const cardOf = (state: RunState, view: View): Card | null =>
  view.phase === "ready" ? guide : resultOf(state, view);
