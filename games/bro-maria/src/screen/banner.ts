import { bannerTicks, stages } from "../rules/constants.ts";
import type { State } from "../rules/types.ts";
import { colour } from "./palette.ts";

const font = '"Courier New", ui-monospace, monospace';

function write(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
): void {
  context.font = `bold ${String(size)}px ${font}`;
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = colour.deep;
  context.fillText(text, x + 1, y + 1);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

// The stage the hero is on, small in a corner all the time, and its number large in the middle of the screen as it begins: so a player knows a
// stage has been cleared and what is new. It only draws; nothing reads it.
export function banner(
  context: CanvasRenderingContext2D,
  state: State,
  width: number,
): void {
  write(
    context,
    `STAGE ${String(state.stage)}/${String(stages)}`,
    30,
    4,
    8,
    colour.white,
  );
  const since = state.tick - state.stageStart;
  if (state.stage > 1 && since < bannerTicks)
    write(
      context,
      `STAGE ${String(state.stage)}`,
      width / 2,
      40,
      20,
      colour.coin,
    );
}
