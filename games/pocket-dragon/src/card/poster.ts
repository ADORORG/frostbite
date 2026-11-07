import { block } from "@frostbite/game-sdk/pixels";

import { colour } from "../screen/palette.ts";
import { drawBadges } from "./badges.ts";
import type { CardContent } from "./content.ts";
import { drawCard } from "./frame.ts";
import { drawTrophies } from "./trophies.ts";
import type { Box, Layout } from "./layout.ts";
import { fall, fitted, letterWidth, say, sparkle, wrap } from "./paint.ts";

// The whole picture a player shares: a starry night, the headline, the card, the trophy shelf (`trophies.ts`), the three chapters
// (`badges.ts`) and the invitation, with the game's address when the platform's page is known.
function night(context: CanvasRenderingContext2D, layout: Layout): void {
  const all = { height: layout.height, width: layout.width, x: 0, y: 0 };
  context.fillStyle = fall(context, all, "#1b0d4a", colour.deep);
  context.fillRect(0, 0, layout.width, layout.height);
  // Stars scattered the same way on every card: a little generator of its own, so nothing lines up.
  let seed = 20_261_031;
  const next = (below: number): number => {
    seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
    return Math.floor((seed / 4_294_967_296) * below);
  };
  for (let star = 0; star < 90; star += 1) {
    const x = next(layout.width);
    const y = next(layout.height);
    if (star % 10 === 0)
      sparkle(context, x, y, 22, star % 20 === 0 ? colour.cyan : colour.pink);
    else
      block(context, star % 3 === 0 ? colour.cream : colour.white, x, y, 4, 4);
  }
}

function headline(
  context: CanvasRenderingContext2D,
  box: Box,
  card: CardContent,
): void {
  const brand = "POCKET DRAGON · GLITCHY'S QUEST";
  const small = fitted(brand, box.width, box.height * 0.2, 1);
  say(context, brand, box.x, box.y, small, colour.mint);
  const room = box.height - small * 1.6;
  // One line, unless two lines would be much bigger.
  const one = fitted(card.headline, box.width, room * 0.9, 1);
  const two = fitted(card.headline, box.width, room * 0.45, 2);
  const size = one >= two * 0.8 ? one : two;
  wrap(card.headline, box.width, size).forEach((line, at) =>
    say(
      context,
      line,
      box.x,
      box.y + small * 1.6 + at * size * 1.1,
      size,
      colour.gold,
    ),
  );
}

function invite(
  context: CanvasRenderingContext2D,
  box: Box,
  card: CardContent,
): void {
  const call = card.link === null ? "JOIN THE QUEST" : "JOIN ME ON THE QUEST";
  const small = fitted(call, box.width, Math.min(box.height * 0.2, 40), 1);
  say(context, call, box.x, box.y, small, colour.lavender);
  // An address is broken only after a slash, so each piece must fit a line; plain words wrap as words.
  const parts =
    card.link === null ? [card.invite] : card.invite.split(/(?<=\/)/u);
  const longest = Math.max(...parts.map((part) => part.length));
  const most = Math.min(box.height * 0.28, 56);
  const one = fitted(card.invite, box.width, most, 1);
  const size =
    card.link === null
      ? fitted(card.invite, box.width, most, 3)
      : one >= most * 0.6
        ? one
        : Math.min(most * 0.8, box.width / (letterWidth * (longest + 0.5)));
  const room = Math.max(1, Math.floor(box.width / (size * letterWidth) + 1e-6));
  const lines: string[] = [];
  for (const part of parts) {
    const last = lines.length - 1;
    const joined = (lines[last] ?? "") + part;
    if (last >= 0 && card.link !== null && joined.length <= room)
      lines[last] = joined;
    else lines.push(...wrap(part, box.width, size));
  }
  let y = box.y + small * 1.45;
  for (const line of lines) {
    say(context, line, box.x, y, size, colour.cyan);
    y += size * 1.15;
  }
  const bank = `METAPLASMA BANKED ${card.plasma}`;
  say(
    context,
    bank,
    box.x,
    y + small * 0.3,
    fitted(bank, box.width, small * 0.8, 1),
    colour.mint,
  );
}

export function drawPoster(
  context: CanvasRenderingContext2D,
  layout: Layout,
  card: CardContent,
): void {
  night(context, layout);
  headline(context, layout.headline, card);
  drawCard(context, layout.card, card);
  drawTrophies(context, layout.trophies, card);
  drawBadges(context, layout, card);
  invite(context, layout.invite, card);
}
