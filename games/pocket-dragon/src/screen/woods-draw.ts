import { block } from "@ador/game-sdk/pixels";

import {
  cell,
  clueCount,
  frozen,
  gate,
  size,
  tree,
} from "../rules/woods/constants.ts";
import { cluesRead } from "../rules/woods/tick.ts";
import { fullTurn } from "../rules/woods/trig.ts";
import type { Place, WoodsState } from "../rules/woods/types.ts";
import { colour } from "./palette.ts";
import { breath, minimap, woodsWords } from "./woods-hud.ts";
import {
  charmPictures,
  charmSeen,
  eggPicture,
  partPictures,
  plasmaInView,
  type Projector,
} from "./woods-stash-look.ts";
import {
  chestOpen,
  chestShut,
  frozenTexel,
  gateTexel,
  lanternDark,
  lanternLit,
  moonChestOpen,
  moonChestPicture,
  stoneLit,
  stoneRead,
  thingKey,
  treeTexel,
  type Texel,
} from "./woods-look.ts";

// The maze of the Whispering Woods seen through Glitchy's eyes: a raycaster, one ray for each of the 256 columns, walls textured and fogged by
// distance, things drawn as pictures that face the player, the moon and stars overhead, and a map of the paths walked in a corner. It
// reads the state and changes nothing.
export const width = 256;
export const height = 144;
const horizon = height / 2;
const fog = "#140a33";

interface View {
  readonly dx: number;
  readonly dy: number;
  readonly px: number;
  readonly py: number;
  readonly planeX: number;
  readonly planeY: number;
}

const viewOf = (state: WoodsState): View => {
  const angle = (state.angle / fullTurn) * Math.PI * 2;
  return {
    dx: Math.cos(angle),
    dy: Math.sin(angle),
    planeX: -Math.sin(angle) * 0.66,
    planeY: Math.cos(angle) * 0.66,
    px: state.x / cell,
    py: state.y / cell,
  };
};

function sky(context: CanvasRenderingContext2D, state: WoodsState): void {
  const gradient = context.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, "#0b0626");
  gradient.addColorStop(1, "#3b1c6a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, horizon);
  const turn = (state.angle / fullTurn) * width * 4;
  for (let star = 0; star < 40; star += 1) {
    const x = (((star * 97 - turn) % (width * 4)) + width * 4) % (width * 4);
    if (x < width)
      block(
        context,
        star % 5 === 0 ? colour.cyan : colour.white,
        x,
        (star * 37) % (horizon - 10),
        1,
        1,
      );
  }
  const moon =
    ((((640 - state.angle) * 4 + fullTurn * 6) % (fullTurn * 4)) /
      (fullTurn * 4)) *
    width *
    4;
  if (moon < width + 20) {
    block(context, colour.cream, moon - 10, 10, 14, 14);
    block(context, "#0b0626", moon - 5, 8, 12, 12);
  }
  const ground = context.createLinearGradient(0, horizon, 0, height);
  ground.addColorStop(0, "#14301f");
  ground.addColorStop(1, "#2f6b3a");
  context.fillStyle = ground;
  context.fillRect(0, horizon, width, height - horizon);
}

const texelFor = (state: WoodsState, wall: number): Texel =>
  wall === frozen
    ? frozenTexel
    : wall === gate
      ? gateTexel(cluesRead(state) >= clueCount)
      : treeTexel;

const solid = (state: WoodsState, index: number): number => {
  const wall = state.level.walls[index] ?? tree;
  return wall === frozen && state.melted ? 0 : wall;
};

// Casts every column's ray and draws its wall; returns how far each column's wall is, for the things in front of it.
function walls(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  view: View,
): readonly number[] {
  const depth: number[] = [];
  for (let column = 0; column < width; column += 1) {
    const camera = (2 * column) / width - 1;
    const rx = view.dx + view.planeX * camera;
    const ry = view.dy + view.planeY * camera;
    let mx = Math.floor(view.px);
    let my = Math.floor(view.py);
    const stepX = rx < 0 ? -1 : 1;
    const stepY = ry < 0 ? -1 : 1;
    const deltaX = Math.abs(1 / (rx || 1e-9));
    const deltaY = Math.abs(1 / (ry || 1e-9));
    let sideX = (rx < 0 ? view.px - mx : mx + 1 - view.px) * deltaX;
    let sideY = (ry < 0 ? view.py - my : my + 1 - view.py) * deltaY;
    let side = 0;
    let wall = 0;
    for (let steps = 0; steps < 64 && wall === 0; steps += 1) {
      if (sideX < sideY) {
        sideX += deltaX;
        mx += stepX;
        side = 0;
      } else {
        sideY += deltaY;
        my += stepY;
        side = 1;
      }
      wall =
        mx < 0 || my < 0 || mx >= size || my >= size
          ? tree
          : solid(state, my * size + mx);
    }
    const distance = Math.max(
      0.05,
      side === 0 ? sideX - deltaX : sideY - deltaY,
    );
    depth.push(distance);
    const hit = side === 0 ? view.py + distance * ry : view.px + distance * rx;
    const u = Math.min(15, Math.floor((hit - Math.floor(hit)) * 16));
    const tall = Math.min(height * 4, Math.floor(height / distance));
    const top = horizon - tall / 2;
    const texel = texelFor(state, wall);
    for (let v = 0; v < 16; v += 1) {
      const y0 = Math.floor(top + (tall * v) / 16);
      const y1 = Math.floor(top + (tall * (v + 1)) / 16);
      if (y1 < 0 || y0 > height) continue;
      block(context, texel(u, v), column, y0, 1, Math.max(1, y1 - y0));
    }
    context.globalAlpha = Math.min(
      0.85,
      distance / 7 + (side === 1 ? 0.12 : 0),
    );
    block(context, fog, column, top, 1, tall);
    context.globalAlpha = 1;
  }
  return depth;
}

interface Thing {
  readonly picture: readonly string[];
  readonly place: Place;
}

function thingsOf(state: WoodsState): readonly Thing[] {
  const { level } = state;
  return [
    ...level.chests.map((place, at) => ({
      picture: state.chests[at] === true ? chestOpen : chestShut,
      place,
    })),
    {
      picture: state.moonChest ? moonChestOpen : moonChestPicture,
      place: level.moonChest,
    },
    ...level.clues.map((place, at) => ({
      picture: state.clues[at] === true ? stoneRead : stoneLit,
      place,
    })),
    ...level.lanterns.map((place, at) => ({
      picture: state.lanterns[at] === true ? lanternLit : lanternDark,
      place,
    })),
    ...level.parts.flatMap((place, at) =>
      state.parts[at] === true
        ? []
        : [{ picture: partPictures[at] ?? eggPicture, place }],
    ),
    ...level.eggs.flatMap((place, at) =>
      state.eggs[at] === true ? [] : [{ picture: eggPicture, place }],
    ),
    ...level.charms.flatMap((place, at) =>
      charmSeen(state, at)
        ? [{ picture: charmPictures[at] ?? eggPicture, place }]
        : [],
    ),
  ];
}

// Where a point of the woods (in cells) falls on the screen, for things smaller than a picture.
const projectorOf = (view: View): Projector => {
  const invert = 1 / (view.planeX * view.dy - view.dx * view.planeY);
  return {
    onScreen(x, y) {
      const sx = x - view.px;
      const sy = y - view.py;
      const far = invert * (-view.planeY * sx + view.planeX * sy);
      if (far <= 0.2) return null;
      const across = invert * (view.dy * sx - view.dx * sy);
      return { column: (width / 2) * (1 + across / far), far };
    },
  };
};

function things(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  view: View,
  depth: readonly number[],
): void {
  const invert = 1 / (view.planeX * view.dy - view.dx * view.planeY);
  const seen = thingsOf(state)
    .map((thing) => {
      const sx = thing.place.x + 0.5 - view.px;
      const sy = thing.place.y + 0.5 - view.py;
      return {
        ...thing,
        across: invert * (view.dy * sx - view.dx * sy),
        far: invert * (-view.planeY * sx + view.planeX * sy),
      };
    })
    .filter((thing) => thing.far > 0.2)
    .sort((a, b) => b.far - a.far);
  for (const thing of seen) {
    const centre = (width / 2) * (1 + thing.across / thing.far);
    const tall = Math.floor((height / thing.far) * 0.7);
    const top = horizon + tall / 2 - tall;
    for (
      let column = Math.floor(centre - tall / 2);
      column < centre + tall / 2;
      column += 1
    ) {
      if (column < 0 || column >= width || (depth[column] ?? 0) < thing.far)
        continue;
      const u = Math.floor(((column - (centre - tall / 2)) / tall) * 16);
      thing.picture.forEach((row, v) => {
        const fill = thingKey[row[u] ?? "."];
        if (fill !== undefined)
          block(
            context,
            fill,
            column,
            Math.floor(top + (tall * v) / 16),
            1,
            Math.max(1, Math.ceil(tall / 16)),
          );
      });
    }
  }
}

export function drawMaze(
  context: CanvasRenderingContext2D,
  state: WoodsState,
): void {
  const view = viewOf(state);
  sky(context, state);
  const depth = walls(context, state, view);
  things(context, state, view, depth);
  plasmaInView(context, state, projectorOf(view), depth, horizon);
  breath(context, state);
  minimap(context, state);
  woodsWords(context, state);
}
