import { block } from "@ador/game-sdk/pixels";

import { frostFor, goalOf, type MatchState } from "../rules/state.ts";
import { praiseFrames, type Scene } from "./scene.ts";
import { screenWidth, sideX } from "./layout.ts";
import { colour, frostColour } from "./palette.ts";
import type { View } from "./view.ts";

// What is written beside the board: the level and its goal (a score to make, or frost to clear) with how far along it is, the swaps left, the
// score, the best, a line of news, the praise that rises over the board, and the cards before and after a run. All of it is on the canvas.
const font = '"Courier New", ui-monospace, monospace';
const barWidth = screenWidth - sideX - 4;

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

// How far along the goal of the level is, as a share from 0 to 1: the score made over the score asked, or the frost broken over the frost laid.
export function progressOf(state: MatchState): number {
  const goal = goalOf(state.level);
  if (goal.kind === "score") return Math.min(1, state.levelScore / goal.target);
  const laid = frostFor(state.level);
  return laid === 0 ? 1 : 1 - state.frost.filter(Boolean).length / laid;
}

export function side(
  context: CanvasRenderingContext2D,
  state: MatchState,
  view: View,
  scene: Scene | null,
): void {
  const goal = goalOf(state.level);
  write(context, `LEVEL ${String(state.level)}`, sideX, 4, colour.text, 8);
  write(
    context,
    goal.kind === "score"
      ? `GOAL ${String(goal.target)}`
      : `FROST ${String(state.frost.filter(Boolean).length)} LEFT`,
    sideX,
    15,
    goal.kind === "score" ? colour.textDim : frostColour,
    5,
  );
  block(context, colour.panelLine, sideX, 22, barWidth, 3);
  block(
    context,
    goal.kind === "score" ? colour.cursor : frostColour,
    sideX,
    22,
    Math.floor(barWidth * progressOf(state)),
    3,
  );
  const moves = scene?.moves ?? state.moves;
  write(context, "SWAPS", sideX, 28, colour.textDim, 5);
  write(
    context,
    String(moves),
    sideX,
    34,
    moves <= 3 ? colour.danger : colour.grab,
    10,
  );
  write(context, "SCORE", sideX, 49, colour.textDim, 5);
  write(
    context,
    String(scene?.score ?? state.score),
    sideX,
    55,
    colour.text,
    8,
  );
  write(context, `BEST ${String(view.best)}`, sideX, 67, colour.textDim, 5);
  if (view.phase === "running" && view.toast !== null)
    write(context, view.toast, sideX, 76, colour.cursor, 5);
}

// The praise rises and fades over the middle of the board.
export function praise(context: CanvasRenderingContext2D, scene: Scene): void {
  if (scene.praise === null) return;
  const { age, text } = scene.praise;
  const rise = Math.floor(age / 3);
  context.globalAlpha = Math.min(1, (praiseFrames - age) / 12);
  write(context, text, 45, 36 - rise, colour.grab, age < 6 ? 11 : 9, "center");
  context.globalAlpha = 1;
}

// The banner over the board when a level is cleared, with what the swaps left over were worth.
export function banner(
  context: CanvasRenderingContext2D,
  level: number,
  bonus: number,
): void {
  context.globalAlpha = 0.78;
  block(context, colour.back, 5, 26, 80, 30);
  context.globalAlpha = 1;
  write(context, `LEVEL ${String(level)}`, 45, 29, colour.grab, 9, "center");
  write(context, "CLEARED!", 45, 40, colour.cursor, 9, "center");
  if (bonus > 0)
    write(
      context,
      `SWAP BONUS +${String(bonus)}`,
      45,
      50,
      colour.text,
      5,
      "center",
    );
}

// On the tall screen the same news is in rows under the board: the level and the swaps left, what the goal is (or the latest news) and the score,
// and the bar of how far along the goal is.
export function strip(
  context: CanvasRenderingContext2D,
  state: MatchState,
  view: View,
  scene: Scene | null,
): void {
  const goal = goalOf(state.level);
  const frost = goal.kind !== "score";
  const moves = scene?.moves ?? state.moves;
  const width = 80;
  write(context, `LEVEL ${String(state.level)}`, 5, 88, colour.text, 7);
  write(
    context,
    `SWAPS ${String(moves)}`,
    85,
    88,
    moves <= 3 ? colour.danger : colour.grab,
    7,
    "right",
  );
  const news = view.phase === "running" ? view.toast : null;
  write(
    context,
    news ??
      (goal.kind === "score"
        ? `GOAL ${String(goal.target)}`
        : `FROST ${String(state.frost.filter(Boolean).length)} LEFT`),
    5,
    97,
    news === null ? (frost ? frostColour : colour.textDim) : colour.cursor,
    5,
  );
  write(
    context,
    `SCORE ${String(scene?.score ?? state.score)}`,
    85,
    97,
    colour.text,
    5,
    "right",
  );
  block(context, colour.panelLine, 5, 103, width, 3);
  block(
    context,
    frost ? frostColour : colour.cursor,
    5,
    103,
    Math.floor(width * progressOf(state)),
    3,
  );
}
