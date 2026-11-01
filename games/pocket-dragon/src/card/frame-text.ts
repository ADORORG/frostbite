import { block } from "@ador/game-sdk/pixels";

import { colour } from "../screen/palette.ts";
import type { CardContent } from "./content.ts";
import type { Box } from "./layout.ts";
import { big, fitted, letterWidth, say, wrap } from "./paint.ts";
import { cupKey, cupRows } from "./trophies.ts";

// The lower half of the trading card: the type line, the two moves (each with its little picture, a line about it and its number),
// the quote, and along the bottom the rarity gems, the set and the milestones. Sizes are in hundredths of the card's width (`u`).
const flame = [
  "...f...",
  "..fff..",
  ".ffyff.",
  "ffyyyff",
  "fyyyyyf",
  ".fyyyf.",
  "..fff..",
] as const;
const star = [
  "...g...",
  "...g...",
  "..ggg..",
  "ggggggg",
  ".ggggg.",
  "..g.g..",
  ".g...g.",
] as const;
const gem = ["..c..", ".ccc.", "ccwcc", ".ccc.", "..c.."] as const;
const iconKey = {
  c: colour.cyan,
  f: colour.fire,
  g: colour.gold,
  w: colour.white,
  y: colour.fireHot,
};

// The rarity's gems in a row from (x, y); says where the row ends.
function gems(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  count: number,
): number {
  const scale = Math.max(1, Math.round(size / 5));
  for (let at = 0; at < count; at += 1)
    big(context, gem, iconKey, x + at * scale * 6, y, scale);
  return x + count * scale * 6;
}

export function drawLower(
  context: CanvasRenderingContext2D,
  box: Box,
  card: CardContent,
  u: number,
): void {
  block(context, "#3b2a78", box.x + 7 * u, box.y + 81 * u, 86 * u, 5 * u);
  const type = fitted(card.typeLine, 82 * u, 3 * u, 1);
  say(
    context,
    card.typeLine,
    box.x + 50 * u,
    box.y + 82 * u,
    type,
    colour.cream,
    "center",
  );
  card.moves.forEach((move, at) => {
    const y = box.y + (89 + at * 12) * u;
    big(
      context,
      at === 0 ? flame : star,
      iconKey,
      box.x + 7.5 * u,
      y + 0.4 * u,
      Math.max(1, Math.round(0.8 * u)),
    );
    say(
      context,
      move.name,
      box.x + 15 * u,
      y,
      fitted(move.name, 52 * u, 4.6 * u, 1),
      colour.white,
    );
    const line = fitted(move.text, 58 * u, 2.8 * u, 1);
    say(
      context,
      move.text,
      box.x + 15 * u,
      y + 5.6 * u,
      line,
      colour.lavender,
      "left",
      "italic bold",
    );
    say(
      context,
      move.value,
      box.x + 92 * u,
      y + 0.6 * u,
      fitted(move.value, 20 * u, 6 * u, 1),
      colour.fireHot,
      "right",
    );
  });
  block(
    context,
    colour.lavenderDark,
    box.x + 7 * u,
    box.y + 113 * u,
    86 * u,
    0.5 * u,
  );
  const quote = `“${card.quote}”`;
  const size = fitted(quote, 84 * u, 3.4 * u, 3);
  wrap(quote, 84 * u, size).forEach((text, at) =>
    say(
      context,
      text,
      box.x + 50 * u,
      box.y + 115.5 * u + at * size * 1.25,
      size,
      colour.cream,
      "center",
      "italic bold",
    ),
  );
  const after = gems(
    context,
    box.x + 7 * u,
    box.y + 131.6 * u,
    2.6 * u,
    card.rarity,
  );
  say(
    context,
    card.rarityName,
    after + u,
    box.y + 131.4 * u,
    2.8 * u,
    colour.cyan,
  );
  say(
    context,
    "POCKET DRAGON",
    box.x + 60 * u,
    box.y + 131.4 * u,
    2.8 * u,
    colour.lavender,
    "center",
  );
  // The trophies held, by a little gold cup.
  const count = card.milestones;
  say(
    context,
    count,
    box.x + 93 * u,
    box.y + 131.4 * u,
    2.8 * u,
    colour.gold,
    "right",
  );
  const cup = Math.max(1, Math.round((2.6 * u) / 9));
  big(
    context,
    cupRows,
    cupKey("hills"),
    box.x + 92 * u - count.length * 2.8 * u * letterWidth - 9 * cup,
    box.y + 131.5 * u,
    cup,
  );
}
