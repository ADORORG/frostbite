import { block } from "@ador/game-sdk/pixels";

import { colour } from "../screen/palette.ts";
import { drawArt } from "./art.ts";
import type { CardContent } from "./content.ts";
import { drawLower } from "./frame-text.ts";
import type { Box } from "./layout.ts";
import { fall, fitted, panel, say, sheen, sparkle } from "./paint.ts";

// The trading card: a metal frame by rarity (mint for a spark, cyan and lavender for a flame, gold for a blaze, gold and pink foil for
// the masterful), Glitchy's name and the score across the top, the picture with its stamp, a type line, two moves with their numbers,
// the quote, and along the bottom the rarity, the set and the milestones. Every size is in hundredths of the card's width.
const metals: readonly (readonly [string, string])[] = [
  [colour.mint, colour.mintDark],
  [colour.cyan, colour.lavender],
  [colour.gold, colour.fire],
  [colour.gold, colour.pink],
];
const stampColours: Readonly<Record<CardContent["outcome"], string>> = {
  cleared: colour.mint,
  journey: colour.lavender,
  lost: colour.pink,
  won: colour.gold,
};
function top(
  context: CanvasRenderingContext2D,
  box: Box,
  card: CardContent,
  u: number,
): void {
  say(context, "GLITCHY", box.x + 7 * u, box.y + 5.5 * u, 7 * u, colour.white);
  const title = fitted(card.title, 50 * u, 3.2 * u, 1);
  say(
    context,
    card.title,
    box.x + 7.2 * u,
    box.y + 13.2 * u,
    title,
    colour.gold,
  );
  const size = fitted(card.score, 34 * u, 6 * u, 1);
  say(
    context,
    card.score,
    box.x + 93 * u,
    box.y + 6 * u,
    size,
    colour.fireHot,
    "right",
  );
  say(
    context,
    "POINTS",
    box.x + 93 * u,
    box.y + 13.2 * u,
    2.8 * u,
    colour.cream,
    "right",
  );
}

function picture(
  context: CanvasRenderingContext2D,
  box: Box,
  card: CardContent,
  u: number,
): void {
  const art = {
    height: 60 * u,
    width: 86 * u,
    x: box.x + 7 * u,
    y: box.y + 19 * u,
  };
  block(
    context,
    colour.ink,
    art.x - u,
    art.y - u,
    art.width + 2 * u,
    art.height + 2 * u,
  );
  drawArt(
    context,
    art,
    card.art,
    card.outcome === "won" || (card.outcome === "journey" && card.rarity >= 3),
  );
  sheen(context, art, [0.06, 0.12, 0.2, 0.3][card.rarity - 1] ?? 0.06);
  for (let at = 0; at < card.rarity * 3; at += 1)
    sparkle(
      context,
      art.x + ((at * 37 + 11) % 86) * u,
      art.y + ((at * 23 + 7) % 56) * u + 2 * u,
      (2 + (at % 3)) * u,
      colour.white,
    );
  const size = 3.6 * u;
  const width = card.stamp.length * size * 0.6 + 4 * u;
  block(
    context,
    colour.deep,
    art.x + u,
    art.y + 2.5 * u,
    width + 0.8 * u,
    size + 3.2 * u,
  );
  block(
    context,
    stampColours[card.outcome],
    art.x + 0.4 * u,
    art.y + 1.9 * u,
    width,
    size + 2.4 * u,
  );
  say(context, card.stamp, art.x + 2.4 * u, art.y + 3.1 * u, size, colour.ink);
}

export function drawCard(
  context: CanvasRenderingContext2D,
  box: Box,
  card: CardContent,
): void {
  const u = box.width / 100;
  const [light, dark] = metals[card.rarity - 1] ?? [
    colour.mint,
    colour.mintDark,
  ];
  const metal = context.createLinearGradient(
    box.x,
    box.y,
    box.x + box.width,
    box.y + box.height,
  );
  metal.addColorStop(0, light);
  metal.addColorStop(0.5, colour.white);
  metal.addColorStop(1, dark);
  panel(context, box, metal, colour.ink, u * 0.8, 3 * u);
  const body = {
    height: box.height - 7 * u,
    width: box.width - 7 * u,
    x: box.x + 3.5 * u,
    y: box.y + 3.5 * u,
  };
  panel(
    context,
    body,
    fall(context, body, "#2b1a66", colour.ink),
    colour.ink,
    u * 0.5,
    2 * u,
  );
  if (card.rarity >= 3) sheen(context, body, card.rarity === 4 ? 0.16 : 0.08);
  top(context, box, card, u);
  picture(context, box, card, u);
  drawLower(context, box, card, u);
  if (card.rarity >= 2)
    for (const [x, y] of [
      [2, 2],
      [98, 2],
      [2, 138],
      [98, 138],
    ] as const)
      sparkle(
        context,
        box.x + x * u,
        box.y + y * u,
        (card.rarity + 1) * u,
        colour.white,
      );
}
