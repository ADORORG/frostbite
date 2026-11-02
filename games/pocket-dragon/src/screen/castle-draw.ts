import { block, sprite } from "@ador/game-sdk/pixels";

import { stepOf } from "../rules/castle/guild.ts";
import { mapHeight, mapWidth } from "../rules/castle/map.ts";
import { foes, friends, items, king } from "../rules/castle/places.ts";
import type { CastleState, Spot } from "../rules/castle/types.ts";
import { drawBattle } from "./castle-battle.ts";
import { castleKit } from "./castle-kit.ts";
import { darkness, nightThings, phaseBanner, snow } from "./castle-night.ts";
import { drawRoom, roomCamera } from "./castle-room.ts";
import { landHud, landStash } from "./castle-stash.ts";
import { drawTile } from "./castle-tiles.ts";
import { castleWords } from "./castle-words.ts";
import { spriteScaled } from "./kit-sprites.ts";
import { drawPack } from "./pack-hud.ts";
import { colour } from "./palette.ts";
import {
  crown,
  friendKey,
  glitchyBack,
  glitchyColours,
  glitchyFront,
  glitchySide,
  golemGrumpy,
  golemHappy,
  golemKey,
} from "./sprites.ts";
import { lines, write } from "./text.ts";

// The guild's land from above, sixteen tiles across and nine down, the view following Glitchy. Friends who have joined walk behind
// Glitchy along the trail; the castle's keepers stand in its doors until they cheer up and step aside. It reads the state and changes
// nothing.
export const width = 256;
export const height = 144;
const messageTicks = 240;

const itemPictures: readonly (readonly string[])[] = [
  [
    "..kkkk..",
    ".kyyyyk.",
    "kooooook",
    "koyooook",
    "kooooook",
    ".koooo k",
    "..kkkk..",
    "........",
  ],
  [
    "...kk...",
    "..kppk..",
    ".kpwppk.",
    "kpppwppk",
    "kppppppk",
    ".kkkkkk.",
    "........",
    "........",
  ],
  [
    "...gg...",
    "..g.....",
    ".kbbbbk.",
    "kbbbbbbk",
    "kbbybbbk",
    "kbbbbbbk",
    ".kkkkkk.",
    "........",
  ],
  [
    ".kkkkkk.",
    ".k....k.",
    "kw.y..wk",
    "kw..y.wk",
    "kwy...wk",
    "kw...ywk",
    ".kkkkkk.",
    "........",
  ],
];
const itemKey = {
  b: "#b07a46",
  g: colour.leaf,
  k: colour.ink,
  o: colour.fire,
  p: colour.blush,
  w: colour.ice,
  y: colour.fireHot,
} as const;

// Where Glitchy is drawn, between the tile stepped from and the tile stepped to.
export function glitchyAt(state: CastleState): Spot {
  if (state.step === null) return { x: state.x * 16, y: state.y * 16 };
  const share = Math.min(1, (state.tick - state.step.start) / stepOf(state));
  return {
    x: Math.round(
      (state.step.from.x + (state.x - state.step.from.x) * share) * 16,
    ),
    y: Math.round(
      (state.step.from.y + (state.y - state.step.from.y) * share) * 16,
    ),
  };
}

export function cameraOf(state: CastleState): Spot {
  if (state.room >= 0) return roomCamera;
  const at = glitchyAt(state);
  return {
    x: Math.min(Math.max(0, at.x + 8 - width / 2), mapWidth * 16 - width),
    y: Math.min(Math.max(0, at.y + 8 - height / 2), mapHeight * 16 - height),
  };
}

function glitchy(
  context: CanvasRenderingContext2D,
  state: CastleState,
  camera: Spot,
): void {
  const at = glitchyAt(state);
  const walking =
    state.step !== null &&
    Math.floor((state.tick - state.step.start) / 4) % 2 === 0;
  const side = glitchySide.stand;
  const picture =
    state.facing === "down"
      ? glitchyFront
      : state.facing === "up"
        ? glitchyBack
        : state.facing === "right"
          ? side
          : side.map((row) => [...row].reverse().join(""));
  const scale = state.powers.big ? 2 : 1;
  block(
    context,
    colour.shadow,
    at.x - camera.x + 8 - 5 * scale,
    at.y - camera.y + 14,
    10 * scale,
    2,
  );
  spriteScaled(
    context,
    picture,
    glitchyColours,
    at.x - camera.x + 8 - 8 * scale,
    at.y - camera.y + 16 - 16 * scale - (walking ? 1 : 0),
    scale,
  );
}

function people(
  context: CanvasRenderingContext2D,
  state: CastleState,
  camera: Spot,
): void {
  const joined = friends.flatMap((_, at) =>
    state.friends[at] === true ? [at] : [],
  );
  joined.forEach((friend, slot) => {
    const spot = state.trail[slot];
    if (spot !== undefined)
      sprite(
        context,
        glitchyFront,
        friendKey(friend),
        spot.x * 16 - camera.x,
        spot.y * 16 - camera.y,
      );
  });
  if (state.room >= 0) return;
  friends.forEach((spot, at) => {
    if (state.friends[at] === true) return;
    const x = spot.x * 16 - camera.x;
    const y = spot.y * 16 - camera.y;
    sprite(context, glitchyFront, friendKey(at), x, y);
    write(
      context,
      state.held[at] === true ? "!" : "?",
      x + 8,
      y - 9 + (Math.floor(state.tick / 20) % 2),
      8,
      colour.gold,
    );
  });
  foes.forEach((spot, at) => {
    const cheered = state.cheered[at] === true;
    const x = (spot.x - (cheered ? 1 : 0)) * 16 - camera.x;
    const y = spot.y * 16 - camera.y;
    sprite(context, cheered ? golemHappy : golemGrumpy, golemKey, x, y + 1);
    if (at === king) sprite(context, crown, golemKey, x + 3, y - 2);
  });
  items.forEach((spot, at) => {
    const picture = itemPictures[at];
    if (state.taken[at] === true || picture === undefined) return;
    sprite(
      context,
      picture,
      itemKey,
      spot.x * 16 - camera.x + 4,
      spot.y * 16 - camera.y + 4 + (Math.floor(state.tick / 15) % 2),
    );
  });
}

// The forcefield around Glitchy, blinking in its last two seconds.
function shield(
  context: CanvasRenderingContext2D,
  state: CastleState,
  camera: Spot,
): void {
  if (state.forcefield < 120 && Math.floor(state.tick / 6) % 2 === 0) return;
  const at = glitchyAt(state);
  for (let dot = 0; dot < 20; dot += 1) {
    const angle = (dot / 20) * Math.PI * 2 + state.tick / 30;
    block(
      context,
      dot % 3 === 0 ? colour.white : colour.cyan,
      at.x - camera.x + 8 + Math.cos(angle) * 11,
      at.y - camera.y + 8 + Math.sin(angle) * 11,
      1,
      1,
    );
  }
}

function words(context: CanvasRenderingContext2D, state: CastleState): void {
  const { message } = state;
  if (
    message === null ||
    state.tick - message.tick > messageTicks ||
    state.battle !== null
  )
    return;
  const text = castleWords[message.id] ?? "";
  context.globalAlpha = 0.85;
  block(context, colour.deep, 4, 110, width - 8, 30);
  context.globalAlpha = 1;
  block(context, colour.lavender, 4, 110, width - 8, 1);
  lines(text, 40).forEach((line, row) =>
    write(context, line, width / 2, 114 + row * 10, 8, colour.white),
  );
}

export function drawCastle(
  context: CanvasRenderingContext2D,
  state: CastleState,
): void {
  if (state.battle !== null) {
    block(context, colour.deep, 0, 0, width, height);
    drawBattle(context, state, state.battle);
    return;
  }
  const camera = cameraOf(state);
  if (state.room >= 0) drawRoom(context, state);
  else {
    const firstX = Math.floor(camera.x / 16);
    const firstY = Math.floor(camera.y / 16);
    for (let ty = firstY; ty <= firstY + height / 16 + 1; ty += 1)
      for (let tx = firstX; tx <= firstX + width / 16 + 1; tx += 1)
        drawTile(
          context,
          state,
          tx,
          ty,
          tx * 16 - camera.x,
          ty * 16 - camera.y,
        );
    landStash(context, state, camera);
    nightThings(context, state, camera);
    castleKit(context, state, camera);
  }
  people(context, state, camera);
  if (state.invulnerable === 0 || Math.floor(state.tick / 4) % 2 === 1)
    glitchy(context, state, camera);
  if (state.forcefield > 0) shield(context, state, camera);
  darkness(context, state, camera, glitchyAt(state));
  snow(context, state);
  if (state.fireTick >= 0 && state.tick - state.fireTick < 12) {
    const at = glitchyAt(state);
    block(context, colour.fire, at.x - camera.x + 4, at.y - camera.y - 6, 8, 6);
  }
  words(context, state);
  landHud(context, state);
  drawPack(context, state.powers, state.tick);
  phaseBanner(context, state);
  if (state.goldenEgg)
    write(context, "THE GOLDEN EGG IS YOURS!", width / 2, 40, 12, colour.gold);
}
