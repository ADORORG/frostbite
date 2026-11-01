import { block, sprite } from "@ador/game-sdk/pixels";

import {
  bossOf,
  ghostY,
  guardY,
  rocketY,
  strikeHalf,
  striking,
} from "../rules/hills/boss.ts";
import {
  arenaX,
  groundRow,
  levelTiles,
  pixel,
  tile,
} from "../rules/hills/constants.ts";
import type { HillsState } from "../rules/hills/types.ts";
import { egg } from "./hills-things.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";
import {
  ghostKey,
  ghostRows,
  guardKey,
  guardRows,
  rocketKey,
  rocketRows,
  vexKey,
  vexRows,
} from "./vex.ts";

// The boss fight on the screen: Madame Vex on her ledge (red-eyed before a strike), the strikes' marks and beams, her ghost dragons,
// guards and egg rocket, the eggs set free, and the seal on the portal until the fight is won.
const px = (units: number): number => Math.round(units / pixel);
const groundY = groundRow * (tile / pixel);
const ledgeX = (levelTiles - 4) * (tile / pixel);
const ledgeY = (groundRow - 5) * (tile / pixel);

function vex(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { boss } = state;
  const gone = boss.beaten >= 0 ? state.tick - boss.beaten : 0;
  if (gone > 90) return;
  const warning =
    boss.strike !== null && !striking(boss.strike, state.tick, state.stage);
  const x = ledgeX + 22 - camera + Math.floor(gone / 3);
  const y = ledgeY - vexRows.length - Math.floor(gone / 2);
  sprite(context, vexRows, vexKey(boss.strike !== null), x, y);
  if (warning && Math.floor(state.tick / 4) % 2 === 0) {
    block(context, "#ff2a3a", x + 5, y + 8, 1, 1);
    block(context, "#ff2a3a", x + 9, y + 8, 1, 1);
  }
  if (boss.started >= 0 && boss.beaten < 0 && state.tick - boss.started < 90)
    write(context, "MADAME VEX!", 128, 30, 10, "#ff5fd2");
  if (boss.beaten >= 0 && gone < 90)
    write(context, "I'LL BE BACK, LITTLE DRAGON!", 128, 30, 8, colour.white);
}

function strikes(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { strike } = state.boss;
  if (strike === null) return;
  const on = striking(strike, state.tick, state.stage);
  for (const mark of strike.marks) {
    const x = px(mark) - camera;
    const half = px(strikeHalf);
    if (!on) {
      if (Math.floor(state.tick / 5) % 2 === 0) {
        block(context, "#ff2a3a", x - half, groundY - 2, half * 2, 2);
        block(context, "#ff2a3a", x - 1, groundY - 8, 2, 6);
      }
      continue;
    }
    const fromX = ledgeX + 29 - camera;
    const fromY = ledgeY - 20;
    for (let step = 0; step <= 20; step += 1)
      block(
        context,
        "#ff5f6d",
        fromX + Math.round(((x - fromX) * step) / 20),
        fromY + Math.round(((groundY - 48 - fromY) * step) / 20),
        2,
        2,
      );
    block(context, "#ff2a3a", x - half, groundY - 48, half * 2, 48);
    block(context, "#ffd0d4", x - 3, groundY - 48, 6, 48);
  }
}

function minions(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  const { boss, tick } = state;
  for (const ghost of boss.ghosts) {
    const x = px(ghost.x) - camera;
    const y = px(ghostY(ghost, tick));
    if (ghost.hp > 0) {
      context.globalAlpha = 0.85;
      sprite(
        context,
        ghostRows,
        ghostKey(ghost.hurt > 0 && tick % 4 < 2),
        x - 1,
        y - 4,
      );
      context.globalAlpha = 1;
      for (let heart = 0; heart < ghost.hp; heart += 1)
        block(context, "#ff5fd2", x + 2 + heart * 4, y - 7, 3, 2);
    } else if (tick - ghost.freed < 60) {
      const rise = Math.floor((tick - ghost.freed) / 3);
      for (let spark = 0; spark < 6; spark += 1)
        block(
          context,
          spark % 2 === 0 ? colour.white : colour.lavender,
          x + spark * 2,
          y - rise + (spark % 3) * 3,
          1,
          1,
        );
    }
  }
  for (const guard of boss.guards) {
    const rows =
      guard.dir > 0
        ? guardRows
        : guardRows.map((row) => [...row].reverse().join(""));
    sprite(
      context,
      rows,
      guardKey,
      px(guard.x) - camera,
      px(guardY) + (Math.floor(tick / 8) % 2),
    );
  }
  const { rocket } = boss;
  if (rocket !== null && rocket.hp > 0) {
    const x = px(rocket.x) - camera;
    const y = px(rocketY(tick));
    sprite(
      context,
      rocketRows,
      rocketKey(rocket.hurt > 0 && tick % 4 < 2),
      x,
      y,
    );
    block(context, colour.ink, x + 4, y - 4, 16, 3);
    block(
      context,
      "#ff5fd2",
      x + 5,
      y - 3,
      Math.round((14 * rocket.hp) / 6),
      1,
    );
  }
  for (const [at, freed] of boss.freed.entries())
    if (!freed.caught) egg(context, px(freed.x) - camera, px(freed.y), at);
}

// Turquoise bars and a lock over the portal while it is sealed.
function seal(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  if (state.boss.beaten >= 0) return;
  const x = px(state.level.goalX) - camera + 8;
  for (let bar = -12; bar <= 12; bar += 6)
    block(context, "#2ed8c3", x + bar, groundY - 30, 2, 30);
  block(context, "#169a8e", x - 13, groundY - 30, 27, 2);
  block(context, colour.gold, x - 3, groundY - 18, 7, 6);
  block(context, colour.ink, x, groundY - 16, 1, 2);
}

export function drawArena(
  context: CanvasRenderingContext2D,
  state: HillsState,
  camera: number,
): void {
  if (px(arenaX) - camera > 256) return;
  seal(context, state, camera);
  vex(context, state, camera);
  strikes(context, state, camera);
  minions(context, state, camera);
  const { boss } = state;
  if (boss.started >= 0 && boss.beaten < 0) {
    const left =
      boss.ghosts.filter((ghost) => ghost.hp > 0).length +
      (boss.rocket !== null && boss.rocket.hp > 0 ? 1 : 0);
    write(context, `SEALED: ${String(left)} TO GO`, 128, 14, 7, "#2ed8c3");
    if (
      bossOf(state.stage).rocket &&
      boss.rocket !== null &&
      boss.rocket.hp > 0
    )
      write(
        context,
        "FREE THE EGGS FROM THE ROCKET!",
        128,
        22,
        7,
        colour.white,
      );
  }
  if (boss.beaten >= 0 && state.tick - boss.beaten < 120)
    write(context, "THE PORTAL IS OPEN!", 128, 44, 10, colour.gold);
}
