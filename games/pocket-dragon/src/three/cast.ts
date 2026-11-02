import type { Group, Mesh } from "three";

import type { Facing } from "../rules/grid.ts";
import { cages, defu, hatchery } from "../rules/woods/base-map.ts";
import { mostShadows } from "../rules/woods/constants.ts";
import { laserPhase, waveAt } from "../rules/woods/lair.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { colour } from "../screen/palette.ts";
import { glitchyOnBase } from "../screen/woods-base.ts";
import { tileSize } from "../screen/woods-base-tiles.ts";
import {
  allyLook,
  animateDragon,
  glitchyLook,
  makeDragon,
  shadowLook,
  type Dragon,
} from "./dragon.ts";
import { group, paint, part, shapes, toward, turnToward } from "./parts.ts";
import {
  animateDefu,
  animateGuard,
  makeDefu,
  makeGuard,
  type Defu,
  type Guard,
} from "./people.ts";

// Who moves in the three-dimensional woods: Glitchy (with its breath of fire and its forcefield), the dragons it has freed walking behind
// it in a line, DeFu's guards (one for each route, gone once cheered up), her shadow dragons, and DeFu herself on her platform. Each
// glides from tile to tile and turns the way it goes.
export const facingAngle: Readonly<Record<Facing, number>> = {
  down: 0,
  left: -Math.PI / 2,
  right: Math.PI / 2,
  up: Math.PI,
};

export interface Cast {
  readonly breath: Mesh;
  readonly defu: Defu;
  readonly followers: readonly Dragon[];
  readonly forcefield: Mesh;
  readonly glitchy: Dragon;
  readonly guards: readonly Guard[];
  readonly root: Group;
  readonly shadows: readonly Dragon[];
}

export function makeCast(routes: number): Cast {
  const glitchy = makeDragon(glitchyLook);
  const breath = part(
    shapes.cone,
    paint(colour.fire, { glow: colour.fire, glowing: 2.2, opacity: 0.85 }),
    {
      at: [0, 0.6, 0.75],
      size: [0.2, 0.7, 0.2],
      turn: [-Math.PI / 2, 0, 0],
    },
  );
  breath.castShadow = false;
  const forcefield = part(
    shapes.smoothBall,
    paint(colour.cyan, {
      glow: colour.cyan,
      glowing: 0.8,
      opacity: 0.3,
      smooth: true,
    }),
    {
      at: [0, 0.42, 0],
      size: 0.62,
    },
  );
  forcefield.castShadow = false;
  glitchy.root.add(breath, forcefield);
  const followers = cages.map((_, ally) => makeDragon(allyLook(ally)));
  const guards = Array.from({ length: routes }, () => makeGuard());
  const shadows = Array.from({ length: mostShadows }, () =>
    makeDragon(shadowLook),
  );
  const defuNow = makeDefu();
  defuNow.root.position.set(defu.x + 0.5, 0.4, defu.y + 0.5);
  const root = group([
    glitchy.root,
    ...followers.map((one) => one.root),
    ...guards.map((one) => one.root),
    ...shadows.map((one) => one.root),
    defuNow.root,
  ]);
  for (const one of [...followers, ...shadows]) one.root.visible = false;
  return {
    breath,
    defu: defuNow,
    followers,
    forcefield,
    glitchy,
    guards,
    root,
    shadows,
  };
}

// Glides a model to a tile's middle, turning it the way it moves; says whether it is still on its way.
function glide(root: Group, x: number, z: number, dt: number): boolean {
  const dx = x - root.position.x;
  const dz = z - root.position.z;
  const moving = Math.hypot(dx, dz) > 0.03;
  if (moving)
    root.rotation.y = turnToward(root.rotation.y, Math.atan2(dx, dz), dt);
  root.position.x = toward(root.position.x, x, dt, 9);
  root.position.z = toward(root.position.z, z, dt, 9);
  return moving;
}

// Puts a model at once where it should be (when it first appears).
function place(root: Group, x: number, z: number): void {
  root.position.set(x, root.position.y, z);
}

export function glitchyPoint(
  base: Base,
  tick: number,
): readonly [number, number] {
  const at = glitchyOnBase(base, tick);
  return [at.x / tileSize + 0.5, at.y / tileSize + 0.5];
}

function showGlitchy(
  cast: Cast,
  state: WoodsState,
  base: Base,
  time: number,
  dt: number,
): void {
  const [x, z] = glitchyPoint(base, state.tick);
  const { root } = cast.glitchy;
  root.position.set(x, 0, z);
  root.scale.setScalar(toward(root.scale.x, state.powers.big ? 2 : 1, dt, 6));
  root.rotation.y = turnToward(
    root.rotation.y,
    facingAngle[base.facing],
    dt,
    16,
  );
  root.visible =
    base.invulnerable === 0 || Math.floor(state.tick / 4) % 2 === 1;
  const puffing = state.tick - base.fireTick;
  cast.breath.visible = puffing >= 0 && puffing < 14;
  cast.breath.scale.set(
    0.12 + puffing * 0.012,
    0.3 + puffing * 0.05,
    0.12 + puffing * 0.012,
  );
  cast.breath.position.z = 0.45 + puffing * 0.025;
  cast.forcefield.visible = base.forcefield > 0;
  cast.forcefield.scale.setScalar(0.6 + Math.sin(time * 6) * 0.03);
  animateDragon(
    cast.glitchy,
    time,
    base.step !== null,
    puffing >= 0 && puffing < 20,
  );
}

function showFollowers(cast: Cast, base: Base, time: number, dt: number): void {
  let behind = 0;
  cast.followers.forEach((ally, at) => {
    const freed = base.allies[at] === true;
    const spot = freed ? base.trail[behind] : undefined;
    if (freed) behind += 1;
    const cage = cages[at];
    if (!ally.root.visible && freed && cage !== undefined)
      place(ally.root, cage.x + 0.5, cage.y + 0.5);
    ally.root.visible = freed;
    if (!freed) return;
    const moving =
      spot !== undefined && glide(ally.root, spot.x + 0.5, spot.y + 0.5, dt);
    animateDragon(
      ally,
      time + at,
      moving,
      !moving && Math.sin(time * 2 + at) > 0.9,
    );
  });
}

function showGuards(cast: Cast, base: Base, time: number, dt: number): void {
  cast.guards.forEach((model, route) => {
    const guard = base.guards.find((one) => one.route === route);
    model.root.visible = guard !== undefined;
    if (guard === undefined) return;
    const moving = glide(model.root, guard.x + 0.5, guard.y + 0.5, dt);
    animateGuard(model, time + route, moving, guard.dizzy > 0);
  });
}

// The shadow dragons have no names, so each model follows the nearest one still about (a new one comes out of the factory's door).
function showShadows(cast: Cast, base: Base, time: number, dt: number): void {
  const free = new Set(cast.shadows);
  for (const shadow of base.shadows) {
    const [x, z] = [shadow.x + 0.5, shadow.y + 0.5];
    let nearest: Dragon | undefined;
    for (const model of free)
      if (
        model.root.visible &&
        (nearest === undefined ||
          Math.hypot(model.root.position.x - x, model.root.position.z - z) <
            Math.hypot(
              nearest.root.position.x - x,
              nearest.root.position.z - z,
            ))
      )
        nearest = model;
    const model = nearest ?? [...free].find((one) => !one.root.visible);
    if (model === undefined) continue;
    free.delete(model);
    if (!model.root.visible)
      place(model.root, hatchery.x + 0.5, hatchery.y + 0.5);
    model.root.visible = true;
    animateDragon(model, time * 1.3, glide(model.root, x, z, dt), true);
    model.root.position.y = 0.15 + Math.sin(time * 4) * 0.05;
  }
  for (const model of free) model.root.visible = false;
}

export function showCast(
  cast: Cast,
  state: WoodsState,
  base: Base,
  time: number,
  dt: number,
): void {
  showGlitchy(cast, state, base, time, dt);
  showFollowers(cast, base, time, dt);
  showGuards(cast, base, time, dt);
  showShadows(cast, base, time, dt);
  const wave = waveAt(base, state.tick);
  animateDefu(
    cast.defu,
    time,
    laserPhase(base, state.tick) === "glow",
    wave !== null && wave <= 1,
  );
}
