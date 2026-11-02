import { defu } from "../rules/woods/base-map.ts";
import { sceneTicks } from "../rules/woods/scenes.ts";
import type { Base, WoodsState } from "../rules/woods/types.ts";
import { middleOf } from "../screen/woods-base-tiles.ts";
import { ease } from "./parts.ts";

// Where the camera of the three-dimensional woods is, and what it looks at. While Glitchy walks it follows from above and behind (farther
// back in the hall of the lair, to see DeFu's weapons coming). In the scenes it moves on a path of its own: up from Glitchy's eyes over
// the trees as Glitchy leaves the maze, across the hall to DeFu and back, round the defused rocket, and up after the rocket as it leaves.
export type Point = readonly [number, number, number];
export interface Shot {
  readonly from: Point;
  readonly look: Point;
  // A scene's camera goes exactly where it is told; while playing, it glides.
  readonly glide: boolean;
}

const mix = (one: Point, other: Point, share: number): Point => [
  one[0] + (other[0] - one[0]) * share,
  one[1] + (other[1] - one[1]) * share,
  one[2] + (other[2] - one[2]) * share,
];
const plus = (point: Point, x: number, y: number, z: number): Point => [
  point[0] + x,
  point[1] + y,
  point[2] + z,
];

// The middle of the rocket on the floor of the hall, and how high it has climbed this far into the scene of its launch.
const rocket = middleOf("R");
export const rocketFoot: Point = [rocket.x, 0, rocket.y];
export const rocketLift = (share: number): number => share * share * 18;
const defuHead: Point = [defu.x + 0.5, 1.6, defu.y + 0.5];

// Looking down steeply, so a tree in front hides little; the point looked at stays far enough inside the map that little past its edge
// shows.
const inside = (value: number, least: number, most: number): number =>
  Math.min(most, Math.max(least, value));

function following(base: Base, glitchy: Point): Shot {
  const inLair = base.lairStart >= 0;
  const look: Point = [
    inside(glitchy[0], 5.5, 22.5),
    glitchy[1] + 0.4,
    inside(glitchy[2] - (inLair ? 1 : 0.6), 4.5, 24.5),
  ];
  return {
    from: plus(look, 0, inLair ? 12.5 : 10.5, inLair ? 7.2 : 6),
    glide: true,
    look,
  };
}

export function shotOf(state: WoodsState, base: Base, glitchy: Point): Shot {
  const play = following(base, glitchy);
  const { scene } = state;
  if (scene === null) return play;
  const share = Math.min(1, (state.tick - scene.start) / sceneTicks[scene.id]);
  if (scene.id === "rise") {
    const rising = ease(share / 0.8);
    return {
      from: mix(plus(glitchy, 0, 0.55, 0.35), play.from, rising),
      glide: false,
      look: mix(plus(glitchy, 0, 0.5, -6), play.look, rising),
    };
  }
  if (scene.id === "lair") {
    const there = ease(share / 0.45);
    const back = ease((share - 0.7) / 0.3);
    const look = mix(mix(play.look, defuHead, there), play.look, back);
    return {
      from: mix(plus(look, 0, 3.2, 5.2), play.from, back),
      glide: false,
      look,
    };
  }
  const middle = plus(rocketFoot, 0, 1.5, 0);
  if (scene.id === "peace") {
    const angle = 0.3 + share * 2.4;
    return {
      from: plus(middle, Math.sin(angle) * 6.5, 3, Math.cos(angle) * 6.5),
      glide: false,
      look: middle,
    };
  }
  return {
    from: plus(rocketFoot, 0, 2.2, 8.5),
    glide: false,
    look: plus(middle, 0, rocketLift(share), 0),
  };
}
