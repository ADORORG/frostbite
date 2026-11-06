import type { ResultCard } from "@frostbite/game-sdk/guide";
import { byInput } from "@frostbite/game-sdk/touch";

import { stageAt, type PulseState } from "../rules/state.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";

// The card after a run: how it ended, the stage and the score, the best, and how to go again (a key for a keyboard, a tap for a finger). The SDK
// draws it over the screen at the pixels of the display, so it stays sharp when the small screen is scaled up.
export const resultOf = (state: PulseState, view: View): ResultCard | null =>
  view.phase === "over"
    ? {
        rows: [
          {
            colour: colour.danger,
            text:
              state.cause === "finished"
                ? "TRACK COMPLETE"
                : "THE LIGHT WENT OUT",
            weight: 1.5,
          },
          {
            colour: colour.text,
            text: `STAGE ${String(stageAt(state.tick))}   SCORE ${String(state.score)}`,
            weight: 1.2,
          },
          {
            colour: colour.perfect,
            text: view.newBest ? "NEW BEST!" : `BEST ${String(view.best)}`,
            weight: 1,
          },
          {
            colour: colour.great,
            text: byInput("ENTER TO PLAY AGAIN", "TAP TO PLAY AGAIN"),
            weight: 0.9,
          },
        ],
      }
    : null;
