import { Color, Group, Mesh, SphereGeometry, Vector3 } from "three";

import { taperedTube } from "../body/tube.ts";
import { brushed, painted, type Tone } from "../palette.ts";
import { ropeApart, swingHigh, swingRope, swingSeat } from "../seats.ts";
import { groundAt } from "./meadow.ts";
import { block, drum } from "./shapes.ts";

// The rope swing in the meadow: a round storybook tree with one long bough reaching out, two ropes hung from it, and a board to sit on.
// The ropes and the board turn about the bough as the swing swings (see seats.ts: the lead rides it, and each push sends it higher).
export interface Swing {
  readonly group: Group;
  // How far forward it has swung, in radians.
  update(angle: number): void;
}

// The trunk stands this far east of the seat (the rules keep both clear).
const trunkAway = 1.3;

export function buildSwing(tone: Tone): Swing {
  const group = new Group();
  const { x, z } = swingSeat;
  const floor = groundAt(x, z);
  const bark = painted(tone, {
    color: "#8d6548",
    map: brushed("#8d6548", 97, 3),
  });
  const trunk = new Mesh(
    taperedTube(
      [0, 1.2, 2.6, 3.8, 4.7].map(
        (y, index) =>
          new Vector3(
            x + trunkAway + Math.sin(index * 1.3) * 0.07,
            floor - 0.2 + y,
            z + Math.cos(index * 1.7) * 0.05,
          ),
      ),
      { radius: (t) => 0.3 - t * 0.12, sides: 10 },
    ),
    bark,
  );
  // The bough: out from the trunk over the seat and a little beyond, sagging a hand's breadth under its own weight.
  const bough = new Mesh(
    taperedTube(
      [
        [trunkAway, 3.5],
        [0.75, 3.28],
        [0, 3.15],
        [-0.8, 3.12],
        [-1.5, 3.2],
      ].map(([out = 0, y = 0]) => new Vector3(x + out, floor + y, z)),
      { radius: (t) => 0.17 - t * 0.1, sides: 8 },
    ),
    bark,
  );
  trunk.castShadow = true;
  bough.castShadow = true;
  group.add(trunk, bough);
  // The crown: big round puffs of leaves, high enough to walk and swing under.
  const leaf = painted(tone, { color: "#ffffff" });
  const puffs: readonly (readonly [number, number, number, number, string])[] =
    [
      [1.2, 5.7, 0, 1.9, "#2d4f6e"],
      [0.1, 5.2, 0.9, 1.45, "#24586a"],
      [2.2, 5.1, -0.8, 1.5, "#3b3f7a"],
      [0.6, 6.5, -0.5, 1.4, "#2f6672"],
      [-0.9, 4.75, -0.2, 1.05, "#3b3f7a"],
    ];
  for (const [out, y, across, size, tint] of puffs) {
    const paint = leaf.clone();
    paint.color = new Color(tint);
    const puff = new Mesh(new SphereGeometry(size, 16, 12), paint);
    puff.scale.y = 0.85;
    puff.position.set(x + out, floor + y, z + across);
    puff.castShadow = true;
    group.add(puff);
  }
  // The ropes and the board, hung from the bough and turning about it.
  const hung = new Group();
  hung.position.set(x, floor + swingHigh, z);
  hung.rotation.y = swingSeat.yaw;
  const swinging = new Group();
  hung.add(swinging);
  const rope = painted(tone, { color: "#d9c08a" });
  for (const side of [ropeApart, -ropeApart])
    swinging.add(drum(rope, 0.014, swingRope, [side, -swingRope / 2, 0], 6));
  swinging.add(
    block(
      painted(tone, { color: "#a46b3a", map: brushed("#a46b3a", 98, 2) }),
      [ropeApart * 2 + 0.14, 0.045, 0.22],
      [0, -swingRope - 0.0225, 0],
    ),
  );
  group.add(hung);
  return {
    group,
    update(angle) {
      swinging.rotation.x = -angle;
    },
  };
}
