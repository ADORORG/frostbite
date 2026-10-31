import { block } from "@ador/game-sdk/pixels";

import {
  cell,
  clueCount,
  frozen,
  gate,
  maxTicks,
  open,
  size,
} from "../rules/woods/constants.ts";
import { cluesRead } from "../rules/woods/tick.ts";
import { cosOf, sinOf, unit } from "../rules/woods/trig.ts";
import type { Place, WoodsState } from "../rules/woods/types.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// What is drawn over the woods: a puff of fire when Glitchy breathes, a map of the paths walked so far (the clue stones whisper where
// the next one is, and the last where the moon gate is), and a few words when something is found.
const mapX = 200;
const mapY = 4;
const dot = 3;

export function breath(
  context: CanvasRenderingContext2D,
  state: WoodsState,
): void {
  const age = state.tick - state.breathTick;
  if (state.breathTick < 0 || age > 14) return;
  for (let puff = 0; puff < 6; puff += 1) {
    const reach = (age + puff * 3) * 3;
    const size = 18 - puff * 2;
    block(
      context,
      puff % 2 === 0 ? colour.fire : colour.fireHot,
      128 - size / 2 + ((puff * 7) % 9) - 4,
      144 - reach - size,
      size,
      size,
    );
  }
}

const mark = (
  context: CanvasRenderingContext2D,
  place: Place,
  fill: string,
): void =>
  block(context, fill, mapX + place.x * dot, mapY + place.y * dot, dot, dot);

export function minimap(
  context: CanvasRenderingContext2D,
  state: WoodsState,
): void {
  context.globalAlpha = 0.75;
  block(
    context,
    colour.deep,
    mapX - 2,
    mapY - 2,
    size * dot + 4,
    size * dot + 4,
  );
  context.globalAlpha = 1;
  state.level.walls.forEach((wall, at) => {
    const seen =
      state.visited[at] === true ||
      [1, -1, size, -size].some((step) => state.visited[at + step] === true);
    if (!seen) return;
    const fill =
      wall === open
        ? "#3f7a4f"
        : wall === frozen && !state.melted
          ? colour.ice
          : wall === gate
            ? colour.pink
            : "#1c3a26";
    block(
      context,
      fill,
      mapX + (at % size) * dot,
      mapY + Math.floor(at / size) * dot,
      dot,
      dot,
    );
  });
  const read = cluesRead(state);
  const next = state.level.clues.find((_, at) => state.clues[at] !== true);
  const pulse = Math.floor(state.tick / 15) % 2 === 0;
  if (next !== undefined && pulse) mark(context, next, colour.cyan);
  if (read >= clueCount && pulse)
    mark(
      context,
      { x: state.level.gate % size, y: Math.floor(state.level.gate / size) },
      colour.white,
    );
  state.level.lanterns.forEach((place, at) => {
    if (state.lanterns[at] === true) mark(context, place, colour.fireHot);
  });
  const x = mapX + (state.x / cell) * dot;
  const y = mapY + (state.y / cell) * dot;
  block(context, colour.gold, x - 1, y - 1, 2, 2);
  block(
    context,
    colour.white,
    x + (cosOf(state.angle) * 2) / unit,
    y + (sinOf(state.angle) * 2) / unit,
    1,
    1,
  );
}

const foundWords = {
  chest: "TREASURE!",
  clue: "A CLUE STONE WHISPERS...",
  lantern: "A LANTERN GLOWS",
  melt: "THE FROZEN HEDGE MELTS",
  moon: "THE MOON CHEST!",
} as const;

export function woodsWords(
  context: CanvasRenderingContext2D,
  state: WoodsState,
): void {
  const read = cluesRead(state);
  write(
    context,
    `CLUES ${String(read)}/${String(clueCount)}`,
    4,
    4,
    8,
    colour.cyan,
    "left",
  );
  if (state.tick < 240)
    write(
      context,
      "FIND 3 CLUE STONES TO OPEN THE MOON GATE",
      128,
      118,
      7,
      colour.white,
    );
  const { found } = state;
  if (found !== null && state.tick - found.tick < 120) {
    const words =
      found.kind === "clue" && read >= clueCount
        ? "THE MOON GATE IS OPEN!"
        : foundWords[found.kind];
    write(context, words, 128, 40, 10, colour.gold);
  }
  if (state.escaped)
    write(context, "OUT OF THE WOODS!", 128, 50, 14, colour.gold);
  const left = Math.ceil(Math.max(0, maxTicks - state.tick) / 60);
  write(
    context,
    `MOONLIGHT ${String(Math.floor(left / 60))}:${String(left % 60).padStart(2, "0")}`,
    4,
    14,
    7,
    colour.cream,
    "left",
  );
}
