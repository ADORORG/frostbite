import { block, sprite } from "@ador/game-sdk/pixels";

import { phaseTicks } from "../rules/castle/constants.ts";
import { bubble, cage, throne } from "../rules/castle/places.ts";
import type { CastleState, Spot } from "../rules/castle/types.ts";
import { guardKey, guardRows } from "./defu.ts";
import { egg } from "./hills-things.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// The guild's land at night and in winter: the night's eggs, DeFu's security guards (with their lanterns, an egg held up when they
// carry one, stars when they are dizzy), the cage cart, the forcefield bubble, the dark (lit around Glitchy, wider with the guild's
// light, and around each guard's lantern), the snow, the Legendary Golden Egg on its throne, and the name of each new part of the level.
const width = 256;
const height = 144;

export function nightThings(
  context: CanvasRenderingContext2D,
  state: CastleState,
  camera: Spot,
): void {
  const { tick } = state;
  if (state.phase === "night") {
    const cx = cage.x * 16 - camera.x;
    const cy = cage.y * 16 - camera.y;
    block(context, colour.woodDark, cx, cy + 2, 16, 13);
    const caged = state.eggs.filter((one) => one.state === "caged").length;
    for (let at = 0; at < Math.min(caged, 3); at += 1)
      egg(context, cx + 1 + at * 4, cy + 5, at);
    for (let bar = 0; bar < 5; bar += 1)
      block(context, colour.wood, cx + bar * 4, cy + 2, 1, 13);
    if (!state.forceTaken) {
      const bob = Math.floor(tick / 15) % 2;
      for (let dot = 0; dot < 16; dot += 1) {
        const angle = (dot / 16) * Math.PI * 2 + tick / 30;
        block(
          context,
          dot % 4 === 0 ? colour.white : colour.cyan,
          bubble.x * 16 - camera.x + 8 + Math.cos(angle) * 6,
          bubble.y * 16 - camera.y + 8 + bob + Math.sin(angle) * 6,
          1,
          1,
        );
      }
    }
  }
  state.eggs.forEach((one, at) => {
    if (one.state === "loose")
      egg(context, one.x * 16 - camera.x + 4, one.y * 16 - camera.y + 4, at);
  });
  for (const guard of state.guards) {
    const x = guard.x * 16 - camera.x + 3;
    const y = guard.y * 16 - camera.y + 1;
    sprite(context, guardRows, guardKey, x, y);
    if (guard.carrying >= 0) egg(context, x + 1, y - 9, guard.carrying);
    else block(context, colour.fireHot, x + 9, y + 9, 2, 2);
    if (guard.dizzy > 0)
      for (let star = 0; star < 3; star += 1) {
        const angle = tick / 8 + (star * Math.PI * 2) / 3;
        block(
          context,
          colour.gold,
          x + 5 + Math.cos(angle) * 6,
          y - 2 + Math.sin(angle) * 2,
          2,
          2,
        );
      }
  }
  const tx = throne.x * 16 - camera.x;
  const ty = throne.y * 16 - camera.y;
  block(context, colour.goldDark, tx + 2, ty + 10, 12, 5);
  if (!state.goldenEgg) {
    const shine = Math.floor(tick / 10) % 2;
    block(context, colour.gold, tx + 5, ty + 1, 6, 9);
    block(context, colour.fireHot, tx + 6, ty + 2 + shine, 2, 3);
  }
}

// The dark of the night, in cells of four pixels, lit around Glitchy and the guards' lanterns.
export function darkness(
  context: CanvasRenderingContext2D,
  state: CastleState,
  camera: Spot,
  glitchy: Spot,
): void {
  if (state.phase !== "night" || state.room >= 0) return;
  const lights: readonly (readonly [number, number, number])[] = [
    [glitchy.x - camera.x + 8, glitchy.y - camera.y + 8, 44],
    ...state.guards.map(
      (guard) =>
        [
          guard.x * 16 - camera.x + 10,
          guard.y * 16 - camera.y + 10,
          22,
        ] as const,
    ),
  ];
  for (let y = 0; y < height; y += 4)
    for (let x = 0; x < width; x += 4) {
      const lit = Math.max(
        0,
        ...lights.map(([lx, ly, reach]) => {
          const far = Math.hypot(x + 2 - lx, y + 2 - ly);
          return far >= reach ? 0 : 1 - far / reach;
        }),
      );
      const dark = Math.round((0.72 - 0.72 * Math.min(1, lit * 1.6)) * 10) / 10;
      if (dark <= 0) continue;
      context.fillStyle = `rgb(8 6 40 / ${String(dark)})`;
      context.fillRect(x, y, 4, 4);
    }
}

// Snow falling in winter.
export function snow(
  context: CanvasRenderingContext2D,
  state: CastleState,
): void {
  if (state.phase !== "winter" || state.room >= 0) return;
  for (let flake = 0; flake < 40; flake += 1) {
    const x =
      (flake * 37 + Math.floor(state.tick / 3) * ((flake % 3) + 1)) % width;
    const y = (flake * 53 + state.tick * (1 + (flake % 2))) % height;
    block(context, colour.white, x, y, flake % 5 === 0 ? 2 : 1, 1);
  }
}

const phaseNames = {
  day: ["", ""],
  night: ["NIGHT FALLS", "SAVE THE EGGS FROM DEFU'S GUARDS"],
  winter: ["WINTER COMES", "THE RIVER IS FROZEN: STORM THE CASTLE!"],
} as const;

// The name of a new part of the level, for a while after it begins.
export function phaseBanner(
  context: CanvasRenderingContext2D,
  state: CastleState,
): void {
  const since = state.tick - state.phaseTick;
  if (state.phase === "day" || since > phaseTicks) return;
  const [title, line] = phaseNames[state.phase];
  write(
    context,
    title,
    width / 2,
    34,
    16,
    state.phase === "night" ? colour.lavender : colour.ice,
  );
  write(context, line, width / 2, 54, 8, colour.white);
}
