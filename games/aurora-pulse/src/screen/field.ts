import { block } from "@frostbite/game-sdk/pixels";

import { lanes, lookahead } from "../rules/constants.ts";
import type { PulseState } from "../rules/state.ts";
import {
  hitY,
  laneWidth,
  laneX,
  noteY,
  screenHeight,
  screenWidth,
  topY,
} from "./layout.ts";
import { auroraBands, colour, laneColours } from "./palette.ts";

// The playing field: the aurora behind (bands that drift with the tick, for the eye only), the lanes, the notes coming down them, the line
// they are tapped on, and a flash in a lane that has just been tapped. A note that has been tapped is gone from the state, so it is not drawn.
export function aurora(
  context: CanvasRenderingContext2D,
  state: PulseState,
): void {
  auroraBands.forEach((fill, band) => {
    const drift = Math.floor(state.tick / (3 + band)) % screenWidth;
    context.globalAlpha = 0.35;
    block(context, fill, drift - screenWidth, 4 + band * 22, screenWidth, 12);
    block(context, fill, drift, 4 + band * 22, screenWidth, 12);
  });
  context.globalAlpha = 1;
}

export function lanesView(
  context: CanvasRenderingContext2D,
  state: PulseState,
): void {
  for (let lane = 0; lane < lanes; lane += 1) {
    block(
      context,
      colour.panel,
      laneX(lane),
      topY - 2,
      laneWidth - 1,
      hitY - topY + 14,
    );
    const tapped =
      state.judged !== null &&
      state.judged.lane === lane &&
      state.tick - state.judged.tick < 6;
    if (tapped) {
      context.globalAlpha = 0.5;
      block(
        context,
        laneColours[lane] ?? colour.text,
        laneX(lane),
        topY - 2,
        laneWidth - 1,
        hitY - topY + 14,
      );
      context.globalAlpha = 1;
    }
  }
  block(context, colour.line, laneX(0), hitY, lanes * laneWidth - 1, 1);
  for (const note of state.pending) {
    const y = noteY(note.tick - state.tick, lookahead);
    if (y < topY - 2 || y > screenHeight) continue;
    block(
      context,
      laneColours[note.lane] ?? colour.text,
      laneX(note.lane) + 2,
      y - 2,
      laneWidth - 5,
      4,
    );
  }
}
