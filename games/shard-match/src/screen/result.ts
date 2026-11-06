import {
  bestLine,
  type Card,
  resultWeight,
  type ResultCard,
  type ResultRow,
} from "@frostbite/game-sdk/guide";
import { byInput } from "@frostbite/game-sdk/touch";

import type { MatchState } from "../rules/state.ts";
import { guide } from "../guide.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

// The card after a run: how it ended, the levels and the score, the best, and how to go again. The tall screen (a phone) is narrower, so its
// lines are shorter, and, being for a touch screen, say Start and not Enter. The SDK draws it over the screen at the pixels of the display, so
// it stays sharp when the small screen is scaled up.
export const resultOf = (state: MatchState, view: View): ResultCard | null => {
  if (view.phase !== "over") return null;
  const best: ResultRow = {
    colour: colour.grab,
    text: bestLine(view.best, view.newBest),
    weight: resultWeight.line,
  };
  const heading: ResultRow = {
    colour: colour.danger,
    text: state.cause === "spent" ? "WHAT A RUN!" : "OUT OF SWAPS",
    weight: resultWeight.heading,
  };
  const levels = `LEVELS ${String(state.levelsCleared)}`;
  const score = `SCORE ${String(state.score)}`;
  return view.shape === "tall"
    ? {
        rows: [
          heading,
          { colour: colour.text, text: levels, weight: resultWeight.detail },
          { colour: colour.text, text: score, weight: resultWeight.detail },
          best,
          {
            colour: colour.cursor,
            text: "PRESS START TO PLAY AGAIN",
            weight: resultWeight.prompt,
          },
        ],
      }
    : {
        rows: [
          heading,
          {
            colour: colour.text,
            text: `${levels}   ${score}`,
            weight: resultWeight.detail,
          },
          best,
          {
            colour: colour.cursor,
            text: byInput("ENTER TO PLAY AGAIN", "TAP TO PLAY AGAIN"),
            weight: resultWeight.prompt,
          },
        ],
      };
};

// What is over the screen: the first-screen card while the game waits to begin, the card after a run once it is over, and nothing while a run goes.
export const cardOf = (state: MatchState, view: View): Card | null =>
  view.phase === "ready" ? guide : resultOf(state, view);
