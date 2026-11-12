import {
  Color,
  CylinderGeometry,
  type DataTexture,
  Group,
  Mesh,
  SphereGeometry,
  Vector3,
} from "three";

import { taperedTube } from "../body/tube.ts";
import {
  brushed,
  noise,
  painted,
  srgb,
  texture,
  type Tone,
} from "../palette.ts";
import { ropeApart, swingHigh, swingRope, swingSeat } from "../seats.ts";
import { groundAt } from "./meadow.ts";
import { drum } from "./shapes.ts";

// The rope swing in the meadow: a round storybook tree with one long bough reaching out, two ropes hung from it, and its seat: a
// cross-section of mahogany, an oval slice of the trunk with its rings showing, curved up at the ends like a smile.
// The ropes and the board turn about the bough as the swing swings (see seats.ts: the lead rides it, and each push sends it higher).
export interface Swing {
  readonly group: Group;
  // How far forward it has swung, in radians.
  update(angle: number): void;
}

// The trunk stands this far east of the seat (the rules keep both clear).
const trunkAway = 1.3;

// The growth rings of the slice, painted: dark heartwood in the middle, red-brown rings of uneven width out to the sapwood.
function ringsMap(): DataTexture {
  const random = noise(98);
  // Where each ring ends, from the heart out, and whether it is a dark one.
  const rings: { dark: boolean; out: number }[] = [];
  for (let out = 0.06; out < 1.1; out += 0.025 + random() * 0.05)
    rings.push({ dark: random() > 0.5, out });
  const tones = ["#4a160c", "#5a1f12", "#a5512f", "#8a3b22"].map((tone) =>
    srgb(new Color(tone)),
  );
  return texture(128, (x, y) => {
    const [dx, dy] = [(x - 63.5) / 64, (y - 63.5) / 64];
    const wobble = 1 + 0.04 * Math.sin(Math.atan2(dy, dx) * 5);
    const from = Math.hypot(dx, dy) * wobble;
    const ring = rings.findIndex((one) => from < one.out);
    const edge = ring >= 0 && (rings[ring]?.out ?? 9) - from < 0.012;
    const [r, g, b] = tones[
      ring === 0 ? 0 : edge ? 1 : rings[ring]?.dark === true ? 3 : 2
    ] ?? [138, 59, 34];
    return [r, g, b, 255];
  });
}

function mahoganySeat(tone: Tone): Mesh {
  const wide = ropeApart + 0.1;
  const slice = new CylinderGeometry(1, 1, 0.055, 44, 1);
  const position = slice.getAttribute("position");
  for (let at = 0; at < position.count; at += 1) {
    const [x, z] = [position.getX(at), position.getZ(at)];
    // An oval a little fuller on one side, as a trunk grows, and curved up toward the ropes.
    const out = 1 + 0.05 * Math.sin(Math.atan2(z, x) * 3 + 0.6);
    position.setXYZ(
      at,
      x * wide * out,
      position.getY(at) + 0.085 * x * x,
      z * 0.15 * out,
    );
  }
  slice.computeVertexNormals();
  const face = painted(tone, { color: "#ffffff", map: ringsMap() });
  const seat = new Mesh(slice, [
    painted(tone, { color: "#4a1f14" }),
    face,
    face,
  ]);
  seat.position.y = -swingRope - 0.03;
  seat.castShadow = true;
  return seat;
}

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
  swinging.add(mahoganySeat(tone));
  group.add(hung);
  return {
    group,
    update(angle) {
      swinging.rotation.x = -angle;
    },
  };
}
