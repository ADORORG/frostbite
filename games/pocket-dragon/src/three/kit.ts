import type { Group, Scene } from "three";

import type { Item } from "../rules/kit.ts";
import { baseKit } from "../rules/woods/base-map.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { rollingAt } from "../screen/kit-sprites.ts";
import { colour } from "../screen/palette.ts";
import { group, paint, part, shapes } from "./parts.ts";

// The backpack's share of the woods in three dimensions: each food lying on its tile (turning and bobbing until it is picked up), and a
// glitch blast, a glowing pink ball in a cyan ring, rolling over the tiles.
export interface KitProps {
  readonly blast: Group;
  readonly foods: readonly Group[];
}

const glowing = (fill: string, strength: number) =>
  paint(fill, { glow: fill, glowing: strength, smooth: true });

function makeFood(item: Item): Group {
  if (item === "berry")
    return group([
      part(shapes.smoothBall, glowing(colour.berry, 0.25), {
        at: [-0.06, 0, 0],
        size: 0.09,
      }),
      part(shapes.smoothBall, glowing(colour.berry, 0.25), {
        at: [0.06, 0, 0.02],
        size: 0.09,
      }),
      part(shapes.smoothBall, glowing(colour.berry, 0.25), {
        at: [0, 0.09, 0],
        size: 0.08,
      }),
      part(shapes.cone, paint(colour.grass), {
        at: [0, 0.2, 0],
        size: [0.04, 0.1, 0.04],
      }),
    ]);
  if (item === "mushroom")
    return group([
      part(shapes.cylinder, paint(colour.white), {
        at: [0, -0.04, 0],
        size: [0.05, 0.14, 0.05],
      }),
      part(shapes.smoothBall, glowing(colour.pink, 0.35), {
        at: [0, 0.06, 0],
        size: [0.16, 0.09, 0.16],
      }),
      ...[0, 1, 2].map((at) =>
        part(shapes.ball, glowing(colour.cyan, 0.6), {
          at: [Math.cos(at * 2.1) * 0.1, 0.1, Math.sin(at * 2.1) * 0.1],
          size: 0.025,
        }),
      ),
    ]);
  return group([
    part(shapes.smoothBall, glowing(colour.gold, 0.2), {
      size: [0.1, 0.15, 0.1],
    }),
    ...[0, 1, 2, 3].map((at) =>
      part(shapes.cone, paint(colour.grass), {
        at: [Math.cos(at * 1.57) * 0.03, 0.2, Math.sin(at * 1.57) * 0.03],
        size: [0.03, 0.12, 0.03],
        turn: [Math.sin(at * 1.57) * 0.4, 0, -Math.cos(at * 1.57) * 0.4],
      }),
    ),
  ]);
}

export function makeKitProps(scene: Scene): KitProps {
  const foods = baseKit.map((spot) => {
    const food = makeFood(spot.item);
    food.position.set(spot.x + 0.5, 0.35, spot.y + 0.5);
    return food;
  });
  const blast = group([
    part(shapes.smoothBall, glowing(colour.pink, 1.2), { size: 0.2 }),
    part(shapes.ring, glowing(colour.cyan, 1.4), { size: 0.26 }),
    part(shapes.gem, glowing(colour.white, 1), { size: 0.08 }),
  ]);
  blast.visible = false;
  scene.add(blast, ...foods);
  return { blast, foods };
}

export function showKitProps(
  props: KitProps,
  state: WoodsState,
  base: Base,
  time: number,
): void {
  props.foods.forEach((food, at) => {
    food.visible = base.kitTaken[at] !== true;
    food.rotation.y = time * 1.5 + at;
    food.position.y = 0.35 + Math.sin(time * 2 + at) * 0.06;
  });
  const { blast } = base;
  props.blast.visible = blast !== null;
  if (blast === null) return;
  const at = rollingAt(blast, state.tick);
  props.blast.position.set(at.x + 0.5, 0.25, at.y + 0.5);
  props.blast.rotation.set(time * 9 * blast.dy, time * 7, -time * 9 * blast.dx);
  props.blast.scale.setScalar(1 + Math.sin(time * 40) * 0.08);
}
