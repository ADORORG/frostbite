import { block } from "@frostbite/game-sdk/pixels";

import { cell } from "../rules/woods/constants.ts";
import type { WoodsState } from "../rules/woods/types.ts";
import { colour } from "./palette.ts";

// The pictures of the launcher's parts, the eggs and the secret charms, sixteen by sixteen in the woods' picture key, and metaplasma as
// specks in the air. A charm is only seen from close by.
export const partPictures: readonly (readonly string[])[] = [
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "..kkkkkkkkkkkk..",
    ".kbbbbbbbbbbbbk.",
    ".kbddbbbbbbddbk.",
    "..kkkkkkkkkkkk..",
    "..kssk....kssk..",
    "..kssk....kssk..",
    "...kk......kk...",
    "................",
  ],
  [
    "................",
    "................",
    "................",
    "......kkkk......",
    ".....kssssk.....",
    "......kkkk......",
    ".....kssssk.....",
    "......kkkk......",
    ".....kssssk.....",
    "......kkkk......",
    ".....kssssk.....",
    "......kkkk......",
    ".....kssssk.....",
    "....kkkkkkkk....",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    "...........kkk..",
    "..........kccck.",
    ".........kcccck.",
    "........kcccck..",
    ".......kcccck...",
    "......kcccck....",
    ".....kcccck.....",
    "....kcccck......",
    "...kcccck.......",
    "...kccck........",
    "....kkk.........",
    "................",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    "................",
    ".......kk.......",
    "......kggk......",
    ".kkkkkkggkkkkkk.",
    ".kggggggggggggk.",
    "..kggggggggggk..",
    "...kggggggggk...",
    "...kgggkkgggk...",
    "..kgggk..kgggk..",
    "..kggk....kggk..",
    "..kkk......kkk..",
    "................",
    "................",
    "................",
  ],
];

export const eggPicture = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......kkkk......",
  ".....kwwwwk.....",
  "....kwwpwwwk....",
  "....kwwwwcwk....",
  "....kwcwwwwk....",
  "....kwwwwpwk....",
  ".....kwwwwk.....",
  "......kkkk......",
  "................",
  "................",
];

export const charmPictures: readonly (readonly string[])[] = [
  [
    "................",
    "................",
    ".........kkk....",
    "........kmmk....",
    ".......kmmk.....",
    "......kmmk......",
    ".....kmmmmmmk...",
    "....kkkkmmmk....",
    "........kmk.....",
    ".......kmk......",
    "......kmk.......",
    ".....kmk........",
    "....kk..........",
    "................",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    "................",
    "................",
    "....kkkkkkkk....",
    "..kkwwwwwwwwkk..",
    ".kwwwwllllwwwwk.",
    "kwwwwllkkllwwwwk",
    ".kwwwwllllwwwwk.",
    "..kkwwwwwwwwkk..",
    "....kkkkkkkk....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  [
    "................",
    "................",
    "...kk......kk...",
    "..kwwk....kwwk..",
    "..krrk....krrk..",
    "..krrk....krrk..",
    "..krrk....krrk..",
    "..krrk....krrk..",
    "..krrrk..krrrk..",
    "...krrrkkrrrk...",
    "....krrrrrrk....",
    ".....kkkkkk.....",
    "................",
    "................",
    "................",
    "................",
  ],
];

// A secret charm shows itself within two cells of Glitchy.
export const charmSeen = (state: WoodsState, at: number): boolean => {
  const place = state.level.charms[at];
  return (
    place !== undefined &&
    state.charms[at] !== true &&
    Math.abs(place.x * cell + cell / 2 - state.x) <= 2 * cell &&
    Math.abs(place.y * cell + cell / 2 - state.y) <= 2 * cell
  );
};

export interface Projector {
  // Where a point of the woods (in cells) is on the screen: the column, how far, or null when it is behind Glitchy.
  readonly onScreen: (
    x: number,
    y: number,
  ) => { readonly column: number; readonly far: number } | null;
}

// Metaplasma in view, as specks floating at about eye height, nearer ones bigger; specks behind a hedge are not drawn.
export function plasmaInView(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  projector: Projector,
  depth: readonly number[],
  horizon: number,
): void {
  const { taken, drifting } = state.plasma;
  const draw = (x: number, y: number, at: number, bright: boolean): void => {
    const seen = projector.onScreen(x / cell, y / cell);
    if (seen === null || seen.far > 6) return;
    const column = Math.round(seen.column);
    if (column < 0 || column >= 256 || (depth[column] ?? 0) < seen.far) return;
    const size = seen.far < 1.5 ? 2 : 1;
    const lift = Math.round((14 + (at % 5) * 4) / seen.far);
    const fill = bright
      ? colour.white
      : at % 2 === 0
        ? colour.cyan
        : colour.pink;
    block(context, fill, column, horizon - lift, size, size);
  };
  state.level.motes.forEach((mote, at) => {
    if (taken[at] !== true)
      draw(mote.x, mote.y, at, (at + Math.floor(state.tick / 10)) % 7 === 0);
  });
  drifting.forEach((mote, at) => draw(mote.x, mote.y, at, true));
}
