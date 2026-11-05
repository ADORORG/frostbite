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

const ready = (shape: View["shape"]): readonly Line[] =>
  shape === "tall"
    ? [
        ["SHARD MATCH", colour.grab, 9],
        ["SWAP TWO SHARDS TO", colour.text, 5],
        ["LINE UP THREE OR MORE", colour.text, 5],
        ["BEAT EACH LEVEL'S GOAL", colour.cursor, 5],
        ["IN THE SWAPS GIVEN", colour.cursor, 5],
        ["BREAK THE FROST", colour.text, 5],
        ["ON THE ICE LEVELS", colour.text, 5],
        ["4 MAKE A BOMB, 5 A STAR", colour.grab, 5],
        ["PRESS START", colour.textDim, 6],
      ]
    : [
        ["SHARD MATCH", colour.grab, 10],
        ["SWAP TWO SHARDS: LINE UP THREE OR MORE", colour.text, 5],
        ["REACH EACH LEVEL'S GOAL IN THE SWAPS GIVEN", colour.cursor, 5],
        ["BREAK ALL THE FROST ON THE ICE LEVELS", colour.text, 5],
        ["4 MAKE A BOMB, 5 A STAR - CHAINS PAY MORE", colour.grab, 5],
        [byInput("ENTER TO START", "TAP TO START"), colour.textDim, 5],
      ];

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
  if (view.phase === "ready") card(context, view, ready(view.shape));
  if (view.phase === "over") card(context, view, over(state, view));
}
