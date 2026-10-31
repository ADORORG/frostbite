import { block, sprite } from "@ador/game-sdk/pixels";

import { grumbleOf, moves, showsOf } from "../rules/castle/battle.ts";
import { spiritMax, showTicks } from "../rules/castle/constants.ts";
import { king } from "../rules/castle/places.ts";
import type { Battle, CastleState } from "../rules/castle/types.ts";
import { hints, keeperNames, showNames } from "./castle-words.ts";
import { colour } from "./palette.ts";
import {
  crown,
  friendKey,
  glitchyColours,
  glitchyFront,
  golemGrumpy,
  golemKey,
} from "./sprites.ts";
import { write } from "./text.ts";

// A cheer challenge, drawn over the land: the keeper (big) and its grumble, the guild and its spirit, the hint that gives away the
// keeper's favourite show, the menu of shows, and the show itself while it plays.
function meter(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: number,
  most: number,
  fill: string,
): void {
  write(context, label, x, y, 7, colour.white, "left");
  block(context, colour.ink, x, y + 9, 62, 6);
  block(
    context,
    fill,
    x + 1,
    y + 10,
    Math.round((60 * Math.max(0, value)) / most),
    4,
  );
}

function big(
  context: CanvasRenderingContext2D,
  rows: readonly string[],
  key: Readonly<Record<string, string>>,
  x: number,
  y: number,
): void {
  rows.forEach((row, line) =>
    [...row].forEach((cell, column) => {
      const fill = key[cell];
      if (fill !== undefined)
        block(context, fill, x + column * 2, y + line * 2, 2, 2);
    }),
  );
}

const effectColours = [
  colour.fireHot,
  colour.fire,
  colour.cyan,
  colour.pink,
  colour.gold,
] as const;

function show(
  context: CanvasRenderingContext2D,
  battle: Battle,
  tick: number,
): void {
  const age = tick - battle.since;
  for (let spark = 0; spark < 10; spark += 1) {
    const x = 150 + ((spark * 23 + age * 2) % 70);
    const y = 30 + ((spark * 17 + age) % 50);
    block(
      context,
      effectColours[(battle.last + spark) % effectColours.length] ??
        colour.gold,
      x,
      y,
      2,
      2,
    );
  }
  write(
    context,
    `${showNames[battle.last] ?? ""}! +${String(battle.lastHit)} CHEER`,
    128,
    76,
    9,
    colour.gold,
  );
  if (age > showTicks - 15)
    write(context, "GRUMBLE GRUMBLE...", 196, 20, 7, colour.white);
}

export function drawBattle(
  context: CanvasRenderingContext2D,
  state: CastleState,
  battle: Battle,
): void {
  context.globalAlpha = 0.9;
  block(context, "#1a0f3a", 0, 0, 256, 144);
  context.globalAlpha = 1;
  block(context, "#2a1a5e", 0, 64, 256, 24);
  write(context, keeperNames[battle.foe] ?? "", 196, 4, 8, colour.gold);
  big(context, golemGrumpy, golemKey, 180, 22);
  if (battle.foe === king) big(context, crown, golemKey, 186, 16);
  sprite(context, glitchyFront, glitchyColours, 20, 44);
  state.friends.forEach((joined, at) => {
    if (joined) sprite(context, glitchyFront, friendKey(at), 40 + at * 18, 46);
  });
  meter(context, 8, 6, "GUILD SPIRIT", battle.spirit, spiritMax, colour.mint);
  meter(
    context,
    8,
    24,
    "GRUMBLE",
    battle.grumble,
    grumbleOf(battle.foe),
    colour.lavender,
  );
  const favourite = state.favourites[battle.foe] ?? 0;
  write(context, `HINT: ${hints[favourite] ?? ""}`, 128, 92, 7, colour.cyan);
  if (battle.phase === "show") show(context, battle, state.tick);
  else if (battle.lastReply > 0)
    write(
      context,
      `THE KEEPER GRUMBLED: -${String(battle.lastReply)} SPIRIT`,
      128,
      76,
      7,
      colour.white,
    );
  const shows = showsOf(state);
  shows.forEach((move, at) => {
    const x = 8 + (at % 3) * 82;
    const y = 104 + Math.floor(at / 3) * 18;
    const chosen = at === battle.choice && battle.phase === "choose";
    const tired = move === battle.last;
    block(context, chosen ? colour.gold : colour.lavenderDark, x, y, 78, 15);
    block(context, chosen ? "#3a2a10" : "#241650", x + 1, y + 1, 76, 13);
    write(
      context,
      showNames[move] ?? "",
      x + 39,
      y + 4,
      7,
      tired ? colour.stone : colour.white,
    );
    if (chosen)
      write(
        context,
        `x${String(moves[move]?.power ?? 0)}`,
        x + 72,
        y + 4,
        6,
        colour.gold,
        "right",
      );
  });
}
