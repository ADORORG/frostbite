import { block } from "@ador/game-sdk/pixels";

import {
  charmMove,
  evadeMove,
  grumbleOf,
  menuOf,
  quickMove,
} from "../rules/castle/battle.ts";
import { showTicks } from "../rules/castle/constants.ts";
import { spiritOf } from "../rules/castle/guild.ts";
import { king } from "../rules/castle/places.ts";
import type { Battle, CastleState } from "../rules/castle/types.ts";
import { arena } from "./castle-arena.ts";
import {
  attackNames,
  hints,
  keeperNames,
  moveKeys,
  moveNames,
} from "./castle-words.ts";
import { colour } from "./palette.ts";
import {
  crown,
  friendKey,
  glitchyBack,
  glitchyColours,
  glitchyFront,
  golemGrumpy,
  golemKey,
} from "./sprites.ts";
import { write } from "./text.ts";

// A cheer challenge, set out like a monster battle on a screen of its own: the keeper on its platform (top right) with its grumble bar,
// the guild on theirs (bottom left) with its spirit bar, a box of what just happened, and the moves with their hotkeys.
function bar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  value: number,
  most: number,
  fill: string,
): void {
  block(context, colour.ink, x, y, 62, 5);
  block(context, "#3a2a5a", x + 1, y + 1, 60, 3);
  block(
    context,
    fill,
    x + 1,
    y + 1,
    Math.round((60 * Math.max(0, value)) / most),
    3,
  );
}

function panel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  block(context, colour.ink, x, y, w, h);
  block(context, colour.cream, x + 1, y + 1, w - 2, h - 2);
  block(context, "#f7f0dc", x + 2, y + 2, w - 4, h - 4);
}

export function big(
  context: CanvasRenderingContext2D,
  rows: readonly string[],
  key: Readonly<Record<string, string>>,
  x: number,
  y: number,
  scale: number,
): void {
  rows.forEach((row, line) =>
    [...row].forEach((cell, column) => {
      const fill = key[cell];
      if (fill !== undefined)
        block(
          context,
          fill,
          x + column * scale,
          y + line * scale,
          scale,
          scale,
        );
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

// The move playing out: sparks over the keeper for a show, speed lines for a quick cheer, a swirl of wind round the guild for evade.
function effect(
  context: CanvasRenderingContext2D,
  battle: Battle,
  tick: number,
): void {
  const age = tick - battle.since;
  if (battle.last === evadeMove) {
    for (let line = 0; line < 6; line += 1)
      block(
        context,
        colour.white,
        24 + ((line * 13 + age * 4) % 70),
        70 + line * 5,
        8,
        1,
      );
    return;
  }
  for (let spark = 0; spark < 12; spark += 1) {
    const x = 160 + ((spark * 23 + age * 2) % 64);
    const y = 18 + ((spark * 17 + age) % 40);
    const fill =
      effectColours[(battle.last + spark) % effectColours.length] ??
      colour.gold;
    block(
      context,
      fill,
      x,
      y,
      battle.last === quickMove ? 4 : 2,
      battle.last === quickMove ? 1 : 2,
    );
  }
}

function keeper(
  context: CanvasRenderingContext2D,
  battle: Battle,
  tick: number,
): void {
  block(context, "#6b5f8a", 158, 58, 76, 6);
  block(context, "#8f86b0", 162, 56, 68, 3);
  const shake =
    battle.phase === "show" &&
    battle.last !== evadeMove &&
    tick - battle.since < 12
      ? (tick % 2) * 2 - 1
      : 0;
  big(context, golemGrumpy, golemKey, 180 + shake, 24, 2);
  if (battle.foe === king) big(context, crown, golemKey, 186 + shake, 18, 2);
  panel(context, 6, 6, 104, 26);
  write(context, keeperNames[battle.foe] ?? "", 10, 9, 7, colour.ink, "left");
  write(
    context,
    `GRUMBLE ${String(Math.max(0, battle.grumble))}/${String(grumbleOf(battle.foe))}`,
    10,
    18,
    6,
    colour.ink,
    "left",
  );
  bar(context, 44, 25, battle.grumble, grumbleOf(battle.foe), "#e8344e");
}

function guild(
  context: CanvasRenderingContext2D,
  state: CastleState,
  battle: Battle,
): void {
  block(context, "#3f8a4a", 14, 100, 86, 6);
  block(context, "#5fd068", 18, 98, 78, 3);
  state.friends.forEach((joined, at) => {
    if (joined) big(context, glitchyFront, friendKey(at), 12 + at * 20, 82, 1);
  });
  big(context, glitchyBack, glitchyColours, 40, 68, 2);
  panel(context, 146, 70, 104, 30);
  write(context, "GLITCHY'S GUILD", 150, 73, 7, colour.ink, "left");
  write(
    context,
    `SPIRIT ${String(Math.max(0, battle.spirit))}/${String(spiritOf(state))}`,
    150,
    82,
    6,
    colour.ink,
    "left",
  );
  bar(context, 184, 90, battle.spirit, spiritOf(state), colour.mint);
  const status = [
    battle.star ? "STAR" : "",
    battle.shield > 0 ? `SHIELD ${String(battle.shield)}` : "",
    battle.evading ? "EVADING" : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (status !== "") write(context, status, 150, 91, 5, "#169a8e", "left");
}

// What just happened, in the box, while it plays; otherwise the keeper's hint.
function told(battle: Battle, tick: number): string | null {
  if (battle.phase === "show") {
    if (battle.last === evadeMove)
      return "GLITCHY'S GUILD GETS READY TO DODGE!";
    const name = moveNames[battle.last] ?? "";
    return tick - battle.since > showTicks - 15
      ? `${keeperNames[battle.foe] ?? ""} IS ABOUT TO GRUMBLE...`
      : `${name}! -${String(battle.lastHit)} GRUMBLE`;
  }
  if (battle.attack >= 0 && tick - battle.since < 90) {
    const attack = attackNames[battle.foe]?.[battle.attack] ?? "";
    return battle.dodged
      ? `${attack}... IT MISSED!`
      : `${attack}! -${String(battle.lastReply)} SPIRIT`;
  }
  return null;
}

function moveMenu(
  context: CanvasRenderingContext2D,
  state: CastleState,
  battle: Battle,
): void {
  const menu = menuOf(state);
  menu.forEach((move, at) => {
    const x = 6 + (at % 4) * 62;
    const y = 124 + Math.floor(at / 4) * 10;
    const chosen = at === battle.choice && battle.phase === "choose";
    const tired = move === battle.last && move !== quickMove;
    if (chosen) block(context, colour.gold, x - 2, y - 1, 60, 9);
    const label = move === charmMove ? "CHARM" : (moveNames[move] ?? "");
    write(
      context,
      `${moveKeys[move] ?? ""} ${label}`,
      x,
      y,
      6,
      tired ? colour.stone : colour.ink,
      "left",
    );
  });
}

export function drawBattle(
  context: CanvasRenderingContext2D,
  state: CastleState,
  battle: Battle,
): void {
  arena(context, battle.foe, state.tick);
  keeper(context, battle, state.tick);
  guild(context, state, battle);
  if (battle.phase === "show") effect(context, battle, state.tick);
  panel(context, 2, 104, 252, 38);
  const favourite = state.favourites[battle.foe] ?? 0;
  write(
    context,
    told(battle, state.tick) ?? `HINT: ${hints[favourite] ?? ""}`,
    8,
    108,
    7,
    colour.ink,
    "left",
  );
  moveMenu(context, state, battle);
}
