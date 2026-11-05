import { block } from "@frostbite/game-sdk/pixels";

import type { MatchState } from "../rules/state.ts";
import { write } from "./hud.ts";
import { sizeOf } from "./layout.ts";
import { colour } from "./palette.ts";
import type { View } from "./view.ts";
import { byInput } from "@frostbite/game-sdk/touch";

// The cards over the screen before a run and after it. Each line is its text, its colour and the size of its writing; the tall screen is narrower, so its
// lines are shorter, and (being for a touch screen) say Start, not Enter.
type Line = readonly [string, string, number];

function card(
  context: CanvasRenderingContext2D,
  view: View,
  lines: readonly Line[],
): void {
  const { height, width } = sizeOf(view.shape);
  context.globalAlpha = 0.84;
  block(context, colour.back, 0, 0, width, height);
  context.globalAlpha = 1;
  const gap = view.shape === "tall" ? 9 : 12;
  lines.forEach(([text, fill, size], index) => {
    write(
      context,
      text,
      width / 2,
      view.shape === "tall" ? 14 + index * gap : 20 + index * gap,
      fill,
      size,
      "center",
    );
  });
}

const over = (state: MatchState, view: View): readonly Line[] => {
  const tall = view.shape === "tall";
  const best: Line = [
    view.newBest ? "NEW BEST!" : `BEST ${String(view.best)}`,
    colour.grab,
    6,
  ];
  const heading: Line = [
    state.cause === "spent" ? "WHAT A RUN!" : "OUT OF SWAPS",
    colour.danger,
    8,
  ];
  return tall
    ? [
        heading,
        [`LEVELS ${String(state.levelsCleared)}`, colour.text, 6],
        [`SCORE ${String(state.score)}`, colour.text, 6],
        best,
        ["PRESS START TO PLAY AGAIN", colour.cursor, 4],
      ]
    : [
        heading,
        [
          `LEVELS ${String(state.levelsCleared)}   SCORE ${String(state.score)}`,
          colour.text,
          6,
        ],
        best,
        [byInput("ENTER TO PLAY AGAIN", "TAP TO PLAY AGAIN"), colour.cursor, 5],
      ];
};

export function cards(
  context: CanvasRenderingContext2D,
  state: MatchState,
  view: View,
): void {
  if (view.phase === "over") card(context, view, over(state, view));
}
