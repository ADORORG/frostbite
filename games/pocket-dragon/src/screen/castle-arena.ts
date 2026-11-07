import { block } from "@frostbite/game-sdk/pixels";

import { colour } from "./palette.ts";

// The stage of each cheer challenge, a screen of its own: the gate guard's sunny courtyard, the hall guard's torch-lit hall, the tower
// guard's starry rooftop, and the king's throne room.
const skies = [
  ["#7ec3ff", "#c9f1ff"],
  ["#3a2a4a", "#5a4a6a"],
  ["#120a33", "#3a2a7a"],
  ["#5a1a3a", "#a83a5a"],
] as const;

export function arena(
  context: CanvasRenderingContext2D,
  foe: number,
  tick: number,
): void {
  const [high, low] = skies[foe] ?? skies[0];
  const sky = context.createLinearGradient(0, 0, 0, 104);
  sky.addColorStop(0, high);
  sky.addColorStop(1, low);
  context.fillStyle = sky;
  context.fillRect(0, 0, 256, 104);
  if (foe === 0) {
    for (let x = 0; x < 256; x += 16)
      block(context, colour.stone, x, 34, 12, 8);
    block(context, colour.stone, 0, 42, 256, 26);
    block(context, colour.stoneDark, 0, 66, 256, 2);
    block(context, colour.grass, 0, 68, 256, 36);
  } else if (foe === 1) {
    for (let x = 8; x < 256; x += 48) {
      block(context, colour.woodDark, x, 30, 3, 14);
      block(
        context,
        tick % 20 < 10 ? colour.fire : colour.fireHot,
        x - 1,
        24,
        5,
        6,
      );
    }
    block(context, "#2a1a3a", 0, 68, 256, 36);
    block(context, "#b8323f", 60, 68, 136, 36);
  } else if (foe === 2) {
    for (let star = 0; star < 30; star += 1)
      if ((star + Math.floor(tick / 15)) % 6 !== 0)
        block(context, colour.white, (star * 37) % 256, (star * 13) % 60, 1, 1);
    block(context, colour.cream, 24, 10, 12, 12);
    block(context, colour.stoneDark, 0, 68, 256, 36);
    for (let x = 0; x < 256; x += 20)
      block(context, colour.stone, x, 64, 14, 6);
  } else {
    block(context, colour.gold, 112, 8, 32, 40);
    block(context, "#b8323f", 116, 12, 24, 36);
    for (let x = 16; x < 256; x += 64) {
      block(context, "#7d55d9", x, 0, 14, 40);
      block(context, colour.gold, x + 5, 30, 4, 4);
    }
    block(context, "#3a1a2a", 0, 68, 256, 36);
    block(context, colour.gold, 0, 68, 256, 2);
  }
}
