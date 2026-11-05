import { block } from "@frostbite/game-sdk/pixels";

import type { RunState } from "../rules/types.ts";
import { colour } from "./palette.ts";
import { ballX, screenY } from "./layout.ts";

// The snowball: eight pixels across, with two eyes and a scarf that streams behind it (longer and waving more the faster it goes). It turns as
// it rolls (a darker band moves round it with the distance) and casts a shadow on the snow that shrinks the higher it goes.
const rows = [
  "..oooo..",
  ".obbbbo.",
  "obbbbbbo",
  "obbbbbbo",
  "obbbbbbo",
  "obbbbbbo",
  ".obbbbo.",
  "..oooo..",
] as const;

export function snowball(
  context: CanvasRenderingContext2D,
  state: RunState,
): void {
  const bottom = screenY(state.y);
  const top = bottom - 8;
  const turn = Math.floor(state.distance / 40) % 8;
  if (state.y >= 0) {
    const shadow = Math.max(3, 8 - Math.floor(state.y / 40));
    block(
      context,
      colour.shadow,
      ballX + (8 - shadow) / 2,
      screenY(0),
      shadow,
      1,
    );
  }
  // The scarf: three pieces behind the neck, each lower and further back, waving with the tick.
  const length = 3 + Math.min(3, Math.floor(state.distance / 40_000));
  for (let piece = 0; piece < length; piece += 1) {
    const wave = ((state.tick >> 2) + piece) % 2;
    const lift = state.y > 0 ? -piece : piece % 2;
    block(
      context,
      piece % 2 === 0 ? colour.scarf : colour.scarfDark,
      ballX - 2 - piece * 2,
      top + 5 + lift + wave,
      2,
      2,
    );
  }
  rows.forEach((row, line) => {
    [...row].forEach((cell, column) => {
      if (cell === ".") return;
      const shaded = (column + line * 3) % 8 === turn && cell === "b";
      const fill =
        cell === "o"
          ? colour.snowDark
          : shaded
            ? colour.ballShade
            : colour.ball;
      block(context, fill, ballX + column, top + line, 1, 1);
    });
  });
  block(context, colour.outline, ballX + 5, top + 3, 1, 2);
  block(context, colour.outline, ballX + 3, top + 3, 1, 2);
  block(context, colour.scarf, ballX + 1, top + 6, 6, 1);
}
