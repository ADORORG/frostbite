import { block, sprite } from "@ador/game-sdk/pixels";

import { blazeTicks, itemList, type Item, type Powers } from "../rules/kit.ts";
import { kitIcons, kitKey } from "./kit-sprites.ts";
import { byInput } from "../page/input.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// The backpack on the screen, the same in every level: a little column at the right edge with each food and how many there are (dim when
// there are none), a flame bar beside it while a berry's blaze lasts, and BIG under it while Glitchy is big. It shows once there is
// anything in the backpack. A line comes up near the top as a food goes in (with its key, or the Bag on a touch screen), is used, or
// takes a bump.
export const packX = 234;
export const packY = 58;
export const newsTicks = 150;
// The line about the backpack goes under the counts at the top of the screen, clear of Glitchy in every level.
export const newsY = 28;

const packedWords: Readonly<Record<Item, readonly [string, string]>> = {
  berry: ["A BERRY! B FOR LONGER FIRE", "A BERRY IN THE BAG: LONGER FIRE"],
  mushroom: [
    "A MUSHROOM! R TO ROLL A GLITCH BLAST",
    "A MUSHROOM IN THE BAG: A GLITCH BLAST",
  ],
  pineapple: ["A PINEAPPLE! G TO GROW BIG", "A PINEAPPLE IN THE BAG: GROW BIG"],
};
const usedWords: Readonly<Record<Item, string>> = {
  berry: "BLAZING FIRE!",
  mushroom: "GLITCH BLAST!",
  pineapple: "BIG GLITCHY!",
};
const wordColours: Readonly<Record<Item, string>> = {
  berry: colour.fire,
  mushroom: colour.pink,
  pineapple: colour.gold,
};

export function packWords(
  powers: Powers,
  tick: number,
): { readonly fill: string; readonly text: string } | null {
  const { news } = powers;
  if (news === null || tick - news.tick >= newsTicks) return null;
  const text =
    news.what === "packed"
      ? byInput(...packedWords[news.item])
      : news.what === "used"
        ? usedWords[news.item]
        : "THE PINEAPPLE TOOK THE BUMP!";
  return { fill: wordColours[news.item], text };
}

export function drawPack(
  context: CanvasRenderingContext2D,
  powers: Powers,
  tick: number,
): void {
  const showing =
    itemList.some((item) => powers.pack[item] > 0) ||
    powers.blaze > 0 ||
    powers.big;
  if (showing) {
    context.fillStyle = "rgb(12 6 32 / 0.62)";
    context.fillRect(packX, packY, 20, 38);
    itemList.forEach((item, at) => {
      const top = packY + 3 + at * 12;
      const count = powers.pack[item];
      context.globalAlpha = count > 0 ? 1 : 0.35;
      sprite(context, kitIcons[item], kitKey, packX + 2, top);
      write(context, String(count), packX + 12, top, 7, colour.white, "left");
      context.globalAlpha = 1;
    });
    if (powers.blaze > 0) {
      const tall = Math.ceil((36 * powers.blaze) / blazeTicks);
      block(context, colour.fire, packX - 2, packY + 37 - tall, 1, tall);
    }
    if (powers.big)
      write(context, "BIG", packX + 10, packY + 40, 7, colour.gold);
  }
  const words = packWords(powers, tick);
  if (words === null) return;
  const wide = words.text.length * 4 + 8;
  context.fillStyle = "rgb(12 6 32 / 0.62)";
  context.fillRect(128 - wide / 2, newsY - 2, wide, 11);
  write(context, words.text, 128, newsY, 7, words.fill);
}
