import { block, sprite } from "@ador/game-sdk/pixels";

import { tileAt } from "../rules/castle/map.ts";
import { boulders, brambles } from "../rules/castle/places.ts";
import type { CastleState } from "../rules/castle/types.ts";
import { colour } from "./palette.ts";

// One tile of the guild's land, sixteen pixels square, at (x, y) on the screen. What a boulder, a bramble, the ice or the ford looks like
// depends on what the guild has done to it.
// Grass, or in winter snow.
const grassy = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tx: number,
  ty: number,
  winter = false,
): void => {
  block(context, winter ? "#eef6ff" : colour.grass, x, y, 16, 16);
  const tuft = winter ? "#c9dcf2" : colour.grassDark;
  if ((tx * 7 + ty * 13) % 4 === 0) block(context, tuft, x + 4, y + 9, 1, 2);
  if ((tx * 5 + ty * 3) % 3 === 0) block(context, tuft, x + 11, y + 4, 1, 2);
};

// The river frozen over in winter.
function frozen(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tx: number,
): void {
  block(context, "#bfe6ff", x, y, 16, 16);
  block(context, colour.white, x + ((tx * 5) % 9), y + 5, 6, 1);
  block(context, "#8fcbec", x + 3, y + 11, 4, 1);
}

function water(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  tx: number,
  tick: number,
): void {
  block(context, "#3a7fd8", x, y, 16, 16);
  const wave = (Math.floor(tick / 20) + tx) % 4;
  block(context, "#7ec3ff", x + wave * 3, y + 4, 5, 1);
  block(context, "#7ec3ff", x + ((wave + 2) % 4) * 3, y + 11, 5, 1);
}

const at = (
  list: readonly { x: number; y: number }[],
  x: number,
  y: number,
): number => list.findIndex((spot) => spot.x === x && spot.y === y);

export function drawTile(
  context: CanvasRenderingContext2D,
  state: CastleState,
  tx: number,
  ty: number,
  x: number,
  y: number,
): void {
  const tile = tileAt(tx, ty);
  const winter = state.phase === "winter";
  switch (tile) {
    case ",":
      block(context, winter ? "#d8d2c8" : "#d9b77a", x, y, 16, 16);
      if ((tx + ty) % 3 === 0) block(context, "#b8935a", x + 6, y + 7, 2, 2);
      return;
    case "f":
      grassy(context, x, y, tx, ty, winter);
      block(
        context,
        (tx + ty) % 2 === 0 ? colour.pink : colour.gold,
        x + 4,
        y + 5,
        2,
        2,
      );
      block(context, colour.white, x + 10, y + 10, 2, 2);
      return;
    case "s":
      block(context, "#f4dfa0", x, y, 16, 16);
      if ((tx * 3 + ty) % 4 === 0)
        block(context, "#d9bf7a", x + 8, y + 6, 1, 1);
      return;
    case "~":
      if (winter) frozen(context, x, y, tx);
      else water(context, x, y, tx, state.tick);
      return;
    case "L":
      if (winter) {
        frozen(context, x, y, tx);
        return;
      }
      water(context, x, y, tx, state.tick);
      if (state.lilies) {
        block(context, colour.leaf, x + 2, y + 3, 11, 10);
        block(context, colour.grassDark, x + 7, y + 3, 2, 5);
        block(context, colour.pink, x + 4, y + 5, 2, 2);
      }
      return;
    case "c":
      block(context, (tx + ty) % 2 === 0 ? "#6f6a9a" : "#5d5888", x, y, 16, 16);
      return;
    case "W":
      block(context, colour.stoneDark, x, y, 16, 16);
      block(context, colour.stone, x + 1, y + 1, 6, 6);
      block(context, colour.stone, x + 9, y + 1, 6, 6);
      block(context, colour.stone, x + 1, y + 9, 14, 6);
      return;
    case "H": {
      const roof = tileAt(tx, ty - 1) !== "H";
      block(context, roof ? "#d8504f" : "#e8c79a", x, y, 16, 16);
      if (roof)
        block(context, winter ? colour.white : "#a83434", x, y + 12, 16, 4);
      else block(context, "#7ec3ff", x + 5, y + 4, 6, 5);
      return;
    }
    case "D":
      block(context, "#e8c79a", x, y, 16, 16);
      block(context, colour.woodDark, x + 4, y + 3, 8, 13);
      block(context, colour.gold, x + 9, y + 9, 2, 2);
      return;
    case "G":
      block(context, "#6f6a9a", x, y, 16, 16);
      for (let bar = 0; bar < 4; bar += 1)
        block(
          context,
          colour.ink,
          x + 1 + bar * 4,
          y,
          2,
          state.gateOpen ? 3 : 16,
        );
      if (!state.gateOpen) block(context, colour.ink, x, y + 7, 16, 2);
      return;
    case "T":
      grassy(context, x, y, tx, ty, winter);
      block(context, colour.woodDark, x + 6, y + 10, 4, 6);
      block(context, colour.leaf, x + 1, y + 1, 14, 11);
      block(context, "#2f8a4a", x + 3, y + 6, 10, 5);
      block(
        context,
        winter ? colour.white : "#7bd96b",
        x + (winter ? 1 : 4),
        y + (winter ? 1 : 3),
        winter ? 14 : 3,
        winter ? 4 : 2,
      );
      return;
    default:
      grassy(context, x, y, tx, ty, winter);
  }
  if (tile === "o" && state.pushed[at(boulders, tx, ty)] !== true)
    sprite(
      context,
      [
        "....kkkk....",
        "..kssssssk..",
        ".ksswsssssk.",
        "kssssssssstk",
        "kssssssstttk",
        ".ktttttttttk",
        "..kkkkkkkk..",
      ],
      { k: colour.ink, s: colour.stone, t: colour.stoneDark, w: colour.white },
      x + 2,
      y + 6,
    );
  if (tile === "#" && state.opened[at(brambles, tx, ty)] !== true)
    sprite(
      context,
      [
        "p..p..p..p..",
        "gggggggggggg",
        "gpgdgggpgdgg",
        "gggggpgggggg",
        "dggpgggdggpg",
        "gggggggggggg",
        "gdggpggdgggg",
        ".dddddddddd.",
      ],
      { d: colour.grassDark, g: "#2f6b3a", p: colour.lavender },
      x + 2,
      y + 6,
    );
  if (tile === "I" && !state.melted) {
    block(context, colour.iceDark, x, y, 16, 16);
    block(context, colour.ice, x + 1, y + 1, 14, 14);
    block(context, colour.white, x + 3, y + 3, 6, 1);
  }
}
