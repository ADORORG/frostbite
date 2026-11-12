import {
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { taperedTube } from "../body/tube.ts";
import { brushed, glowing, painted, type Tone } from "../palette.ts";
import { carFloor, type Riding } from "../ride.ts";
import { block } from "./shapes.ts";

// The family's hover car: a long open pod like a seed, with not a straight line on it. A deep purple hull rimmed in gold, a bubble of
// a windscreen, two curved benches, a pair of sweeping tail fins tipped with light, and under it three rings of gold light it rides
// on in place of wheels. It hums up and down a little as it hovers.
export interface Car {
  readonly group: Group;
  // Where it is this frame (null: not there), `ground` the height of the ground under it.
  update(ride: Riding | null, ground: number, time: number): void;
}

const half = { long: 1.95, wide: 1.08 };

export function buildCar(tone: Tone): Car {
  const group = new Group();
  group.name = "car";
  const body = new Group();
  group.add(body);
  const shell = painted(tone, {
    color: "#ffffff",
    map: brushed("#5d3aa8", 61, 3, 0.5),
    side: DoubleSide,
  });
  const gold = glowing("#e7b04a", 1);
  // The hull: the lower half of a long egg, open at the top.
  const hull = new Mesh(
    new SphereGeometry(1, 40, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    shell,
  );
  hull.scale.set(half.wide, 0.62, half.long);
  hull.position.y = 0.62;
  hull.castShadow = true;
  const rim = new Mesh(new TorusGeometry(1, 0.045, 8, 64), gold);
  rim.scale.set(half.wide, half.long, 1);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.62;
  // The floor inside, and the two benches: the children's in front, the grown-ups' behind and higher.
  const inside = painted(tone, { color: "#2a1a4a" });
  const floor = new Mesh(new SphereGeometry(1, 28, 6), inside);
  floor.scale.set(half.wide * 0.82, 0.04, half.long * 0.82);
  floor.position.y = carFloor;
  const cushion = painted(tone, { color: "#1fa39a" });
  const benches = [
    block(cushion, [1.5, 0.16, 0.5], [0, carFloor + 0.26, 0.36]),
    block(cushion, [1.6, 0.18, 0.5], [0, carFloor + 0.41, -0.7]),
    block(cushion, [1.6, 0.5, 0.14], [0, carFloor + 0.7, -1.0]),
  ];
  // The windscreen: a quarter of a bubble at the nose.
  const screen = new Mesh(
    new SphereGeometry(1, 28, 10, 0, Math.PI, 0, Math.PI / 2),
    new MeshStandardMaterial({
      color: "#9fe8ff",
      opacity: 0.28,
      roughness: 0.1,
      side: DoubleSide,
      transparent: true,
    }),
  );
  screen.scale.set(half.wide * 0.9, 0.62, 0.95);
  screen.position.set(0, 0.6, 0.95);
  // Two tail fins, sweeping up and back, a light at the tip of each; and a lamp at the nose.
  const tip = glowing("#ffcf6a", 3);
  for (const side of [1, -1]) {
    const sweep = [0, 0.3, 0.62, 0.85, 1].map(
      (t) =>
        new Vector3(
          side * (0.72 + t * 0.34),
          0.6 + Math.sin(t * 1.5) * 0.95,
          -1.25 - t * 1.05,
        ),
    );
    const fin = new Mesh(
      taperedTube(sweep, { radius: (t) => 0.12 * (1 - t * 0.7), sides: 8 }),
      shell,
    );
    const light = new Mesh(new SphereGeometry(0.07, 10, 8), tip);
    light.position.copy(sweep[sweep.length - 1] ?? new Vector3());
    body.add(fin, light);
  }
  const lamp = new Mesh(new SphereGeometry(0.13, 12, 8), tip);
  lamp.scale.z = 0.5;
  lamp.position.set(0, 0.5, half.long - 0.08);
  body.add(hull, rim, floor, ...benches, screen, lamp);
  // The rings of light it rides on.
  const rings = [1.05, 0, -1.05].map((along, index) => {
    const ring = new Mesh(
      new TorusGeometry(0.42, 0.035, 6, 32),
      glowing("#ffd25a", 2.4),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, -0.08, along);
    ring.scale.setScalar(index === 1 ? 1.25 : 1);
    body.add(ring);
    return ring;
  });
  group.visible = false;
  return {
    group,
    update(ride, ground, time) {
      group.visible = ride !== null && ride.shown > 0.01;
      if (ride === null || !group.visible) return;
      group.position.set(
        ride.x,
        ground + ride.high + Math.sin(time * 2.1) * 0.03,
        ride.z,
      );
      group.rotation.y = ride.yaw;
      // It grows out of a point of light as it comes, and back into one as it goes.
      body.scale.setScalar(Math.max(0.001, ride.shown));
      rings.forEach((ring, index) => {
        const pulse = 1 + 0.12 * Math.sin(time * 5 + index * 2.1);
        ring.scale.setScalar((index === 1 ? 1.25 : 1) * pulse);
        ring.position.y = -0.08 - 0.1 * ((time * 0.9 + index / 3) % 1);
      });
    },
  };
}
