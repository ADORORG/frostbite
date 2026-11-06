import { block } from "@frostbite/game-sdk/pixels";

import { maxEnergy, lanes } from "../rules/constants.ts";
import { multiplierOf } from "../feedback.ts";
import { stageAt, type PulseState } from "../rules/state.ts";
import { hitY, laneWidth, laneX, screenWidth, topY } from "./layout.ts";
import { colour, laneColours } from "./palette.ts";
import type { View } from "./view.ts";

// What is written over the screen: the stage, the score, the combo and its multiplier, the energy, the verdict on the last tap, the keys, a line
// of news. All of it is on the canvas, so showing more of it never moves the page.
const font = '"Courier New", ui-monospace, monospace';
export const keyNames = ["D", "F", "J", "K"] as const;
// How long a verdict stays on the screen, in ticks.
export const verdictTicks = 30;
const energyX = screenWidth - 12;
// The combo is written right-aligned at this x, clear of the lanes on its left (they end at 116) and of the energy bar on its right.
export const comboX = energyX - 4;
const energyHeight = hitY - topY;

export function write(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  size = 6,
  align: CanvasTextAlign = "left",
): void {
  context.font = `bold ${String(size)}px ${font}`;
  context.textAlign = align;
  context.textBaseline = "top";
  context.fillStyle = colour.back;
  context.fillText(text, x + 0.5, y + 0.5);
  context.fillStyle = fill;
  context.fillText(text, x, y);
}

const verdicts = {
  good: ["GOOD", colour.good],
  great: ["GREAT", colour.great],
  miss: ["MISS", colour.danger],
  perfect: ["PERFECT", colour.perfect],
  stray: ["STRAY", colour.danger],
} as const;

export const energyFill = (energy: number): number =>
  Math.ceil((energy * energyHeight) / maxEnergy);

export function hud(
  context: CanvasRenderingContext2D,
  state: PulseState,
  view: View,
): void {
  for (let lane = 0; lane < lanes; lane += 1)
    write(
      context,
      keyNames[lane] ?? "",
      laneX(lane) + laneWidth / 2 - 1,
      hitY + 5,
      laneColours[lane] ?? colour.text,
      7,
      "center",
    );
  write(context, `STAGE ${String(stageAt(state.tick))}`, 3, 4, colour.text, 7);
  write(context, "SCORE", 3, 16, colour.textDim, 5);
  write(context, String(state.score), 3, 22, colour.text, 7);
  write(context, `BEST ${String(view.best)}`, 3, 34, colour.textDim, 5);
  write(context, "COMBO", comboX, 4, colour.textDim, 5, "right");
  write(context, String(state.combo), comboX, 10, colour.perfect, 9, "right");
  const multiplier = multiplierOf(state.combo);
  if (multiplier > 1)
    write(
      context,
      `x${String(multiplier)}`,
      comboX,
      22,
      colour.great,
      7,
      "right",
    );
  block(context, colour.panelLine, energyX, topY, 6, energyHeight);
  const filled = energyFill(state.energy);
  block(
    context,
    state.energy <= 20 ? colour.danger : colour.perfect,
    energyX,
    topY + energyHeight - filled,
    6,
    filled,
  );
  if (state.judged !== null && state.tick - state.judged.tick < verdictTicks) {
    const [text, fill] = verdicts[state.judged.kind];
    write(context, text, screenWidth / 2, hitY - 12, fill, 8, "center");
  }
  if (
    view.phase === "running" &&
    view.toast !== null &&
    state.tick < view.toast.until
  )
    write(
      context,
      view.toast.text,
      screenWidth / 2,
      10,
      colour.great,
      6,
      "center",
    );
}
